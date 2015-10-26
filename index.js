/* jshint node:true */

'use strict';

var config = require('config');
var pg = require('pg');
var Promise = require('bluebird');

var ACTIONS = [
    'INSERT',
    'SELECT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
];

/** Hold a reference to a `pg.Client`. Configured in the module's export. */
var client;

/**
 * Get a connection string from a configuration object.
 *
 * @param  {object}           config
 * @param  {string}           config.username
 * @param  {string}           config.password
 * @param  {(number|string)=} config.port
 * @param  {string}           config.database
 * @return {string}                           Postgres connection string
 */
function getConnectionString(config) {
    return [
        'postgres://' + config.username + ':' + config.password + '@',
        config.hostname + (config.port ? ':' + config.port : '') + '/',
        config.database,
    ].join('');
}

/**
 * Does a privileges list contain all priveleges?
 *
 * @param  {string}  priveleges
 * @return {boolean}
 */
function hasAllPriveleges(priveleges) {
    return ACTIONS.every(function(action) {
        return priveleges.indexOf(action) !== -1;
    });
}

/**
 * Get view permissions
 *
 * @param  {string}  viewName
 * @return {Promise}          Resolves to an array of permissions lines
 */
function getViewPermissions(viewName) {
    return new Promise(function(resolve, reject) {
        client.query([
            'SELECT grantee, string_agg(privilege_type, \', \') AS privileges',
            'FROM information_schema.role_table_grants',
            'WHERE table_name=\'' + viewName + '\'',
            'GROUP BY grantee;'
        ].join('\n'), function(error, response) {
            if (error) {
                resolve(error);
            }
            resolve(response.rows);
        });
    })
        .then(function(permissions) {
            return permissions
                .map(function(permission) {
                    var output = '';

                    if (permission && permission.privileges) {
                        output += 'GRANT ';

                        if (hasAllPriveleges(permission.privileges)) {
                            output += 'ALL ';
                        } else {
                            output += permission.privileges + ' ';
                        }

                        output += 'ON TABLE ' + viewName + ' TO ';
                        output += permission.grantee;
                    }

                    return output;
                })
                .filter(function(permission) {
                    return !!permission;
                });
        });
}

/**
 * Get view data.
 *
 * @param  {string}  viewName
 * @return {Promise}          Resolves to an object with view data.
 */
function getViewData(viewName) {
    var queryString = [
        'SELECT * FROM pg_views',
        'WHERE viewname = \'' + viewName + '\';',
    ].join('\n');

    return Promise.all([
        new Promise(function(resolve, reject) {
            client.query(queryString, function(error, response) {
                if (error) {
                    reject(error);
                }

                resolve(response.rows);
            });
        }),
        getViewPermissions(viewName),
    ])
        .then(function(results) {
            if (!Array.isArray(results[0]) || !results[0].length) {
                return;
            }

            var viewData = results[0][0];
            var viewPermissions = results[1];
            var ownerSql = 'ALTER TABLE ' + viewData.viewname + ' OWNER TO ' +
                viewData.viewowner;
            var permissions = [ownerSql].concat(viewPermissions).join('\n');

            return {
                definition: viewData.definition,
                permissions: permissions,
                schema: viewData.schemaname,
                viewName: viewName,
            };
        });
}

/**
 * Get all views dependent on a table.
 *
 * @{@link  http://bonesmoses.org/2014/11/05/on-postgresql-view-dependencies/}
 *
 * @param  {string}
 * @return {Promise}
 */
function getDependentViewsFromTableName(tableName) {
    var queryString = [
        'WITH RECURSIVE vlist AS (',
        '    SELECT c.oid::REGCLASS AS view_name',
        '      FROM pg_class c',
        '     WHERE c.relname = \'' + tableName + '\'',
        '     UNION ALL',
        '    SELECT DISTINCT r.ev_class::REGCLASS AS view_name',
        '      FROM pg_depend d',
        '      JOIN pg_rewrite r ON (r.oid = d.objid)',
        '      JOIN vlist ON (vlist.view_name = d.refobjid)',
        '     WHERE d.refobjsubid != 0',
        ')',
        'SELECT * FROM vlist;',
    ].join('\n');

    return new Promise(function(resolve, reject) {
        client.query(queryString, function(error, response) {
            if (error) {
                reject(error);
            }

            resolve(response.rows);
        });
    })
        .then(function(rows) {
            return rows.map(function(row) {
                return row.view_name;
            });
        });
}

/**
 * Get all views dependent on a view.
 *
 * @param  {string}
 * @return {Promise}
 */
function getDependentViewsFromViewName(viewName) {
    var queryString = [
        'WITH RECURSIVE vlist AS (',
        '   SELECT r.ev_class::REGCLASS AS view_name',
        '     FROM pg_depend d1 join pg_rewrite r on r.oid = d1.objid',
        '    WHERE d1.refobjid = \'' + viewName + '\'::regclass',
        '    UNION ALL',
        '   SELECT DISTINCT r.ev_class::REGCLASS AS view_name',
        '     FROM pg_depend d',
        '     JOIN pg_rewrite r ON (r.oid = d.objid)',
        '     JOIN vlist ON (vlist.view_name = d.refobjid)',
        '    WHERE d.refobjsubid != 0',
        ')',
        'SELECT DISTINCT * FROM vlist;',
    ].join('\n');

    return new Promise(function(resolve, reject) {
        client.query(queryString, function(error, response) {
            if (error) {
                reject(error);
            }
            resolve(response.rows);
        });
    })
        .then(function(rows) {
            return rows
                .map(function(row) {
                    return row.view_name;
                })
                .filter(function(name) {
                    return name !== viewName;
                });
        });
}

/**
 * Get view data from tablename.
 *
 * @param  {object|string} tableName
 * @return {Promise}
 */
module.exports = function getViewDataFromTableName(
    connectionConfig,
    tableName
) {
    if (!connectionConfig) {
        throw new Error('PG connection configuration required');
    }

    var connectionString = connectionConfig instanceof Object ?
        getConnectionString(connectionConfig) :
        connectionConfig;

    /** Mutate module-level `client` for internal use */
    client = new pg.Client(connectionString);

    return new Promise(function(resolve, reject) {
        client.connect(function(error) {
            if (error) {
                reject(error);
            }
            resolve();
        });
    })
        .then(function() {
            return getDependentViewsFromTableName(tableName);
        })
        .then(function(viewNames) {
            var dependentViews = viewNames.map(function(viewName) {
                return getDependentViewsFromViewName(viewName);
            });

            return Promise.all(
                [Promise.resolve(viewNames)].concat(dependentViews)
            );
        })
        .then(function(results) {
            var viewNames = results[0];
            var dependentViews = results.slice(1).filter(function(views) {
                return views.length > 0;
            });

            // Remove duplicates
            return [].concat.apply(viewNames, dependentViews)
                .reduce(function(singles, viewName) {
                    if (singles.indexOf(viewName) === -1) {
                        singles.push(viewName);
                    }
                    return singles;
                }, []);
        })
        .then(function(viewNames) {
            return Promise.all(viewNames.map(function(viewName) {
                return getViewData(viewName);
            }));
        })
        .then(function(viewDatas) {
            // Do something useful
            console.log(viewDatas);
        })
        .catch(function(error) {
            console.error(error);
        })
        .then(function() {
            client.end();
        });
};

