/* jshint node:true */

'use strict';

var pg = require('pg');
var Promise = require('bluebird');

var hasAllPrivileges = require('./has-all-privileges.js');
var removeEmptiesAndDuplicates = require('./remove-empties-and-duplicates.js');

/** Hold a reference to a `pg.Client`. Configured in the module's export. */
var client;

/**
 * Hold a reference to the `pg.Client` configuration.
 *
 * @todo  This is necessary to avoid race conditions between closing and opening
 *        clients. Figure out a more secure way to do this.
 */
var config;

/**
 * Get view permissions
 *
 * @param  {string}  viewName
 * @return {Promise}          Resolves to an array of permissions lines
 */
function getViewPermissions(viewName) {
    var queryString = [
        `
        SELECT grantee, string_agg(privilege_type, ', ') AS privileges
        FROM information_schema.role_table_grants
        WHERE table_name='${viewName}'
        GROUP BY grantee;
        `
    ].join('\n');

    return new Promise(function(resolve, reject) {
        client.query(queryString, function(error, response) {
            if (error) {
                return reject(error);
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

                        if (hasAllPrivileges(permission.privileges)) {
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
        `
        SELECT * FROM pg_views
        WHERE viewname = '${viewName}';
        `
    ].join('\n');

    return Promise.all([
        new Promise(function(resolve, reject) {
            client.query(queryString, function(error, response) {
                if (error) {
                    return reject(error);
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
        `
        WITH RECURSIVE vlist AS (
            SELECT c.oid::REGCLASS AS view_name
              FROM pg_class c
             WHERE c.relname = '${tableName}'
             UNION ALL
            SELECT DISTINCT r.ev_class::REGCLASS AS view_name
              FROM pg_depend d
              JOIN pg_rewrite r ON (r.oid = d.objid)
              JOIN vlist ON (vlist.view_name = d.refobjid)
             WHERE d.refobjsubid != 0
        )
        SELECT * FROM vlist;
        `
    ].join('\n');

    return new Promise(function(resolve, reject) {
        client.query(queryString, function(error, response) {
            if (error) {
                return reject(error);
            }

            resolve(response.rows);
        });
    })
        .then(function(rows) {
            return rows
                .map(function(row) {
                    return row.view_name;
                })
                .filter(function(viewName) {
                    return viewName !== tableName;
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
        `
        WITH RECURSIVE vlist AS (
           SELECT r.ev_class::REGCLASS AS view_name
             FROM pg_depend d1 join pg_rewrite r on r.oid = d1.objid
            WHERE d1.refobjid = '${viewName}'::regclass
            UNION ALL
           SELECT DISTINCT r.ev_class::REGCLASS AS view_name
             FROM pg_depend d
             JOIN pg_rewrite r ON (r.oid = d.objid)
             JOIN vlist ON (vlist.view_name = d.refobjid)
            WHERE d.refobjsubid != 0
        )
        SELECT DISTINCT * FROM vlist;
        `
    ].join('\n');

    return new Promise(function(resolve, reject) {
        client.query(queryString, function(error, response) {
            if (error) {
                return reject(error);
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
 * @see getViewData
 *
 * @param  {array}   viewNames
 * @return {Promise}           Resolves to an array of 'view data' objects.
 */
function mapViewNamesToViewData(viewNames) {
    return Promise.all(viewNames.map(function(viewName) {
        return getViewData(viewName);
    }));
}

/**
 * Initiate a client connect.
 *
 * @return {Promise}
 */
function getConnectedClient() {
    if (!config) {
        return Promise.reject(new Error('PG client not configured'));
    }

    /**
     * @todo  Figure out a better way to tap into official 'pg' APIs.
     */
    if (client && !client.connection._ending) {
        return Promise.resolve(client);
    }

    return new Promise(function(resolve, reject) {
        /** Mutate module-level `client` for internal use */
        client = new pg.Client(config);

        client.connect(function(error) {
            if (error) {
                reject(error);
            }
            resolve();
        });
    });
}

/**
 * Close the connected client.
 *
 * @{@link  https://github.com/brianc/node-postgres/wiki/Client#drain-}
 *
 * @return {Promise}
 */
function closeClient() {
    if (client) {
        if (client.activeQuery) {
            client.once('drain', client.end.bind(client));
        } else {
            client.end();
        }
    }
}

/**
 * Configure the `pg.Client`.
 *
 * @{@link  https://github.com/brianc/node-postgres/wiki/Client#new-clientobject-config--client}
 *
 * @param  {object|string} tableName
 * @return {undefined}
 */
function configureClient(clientConfig) {
    if (!clientConfig) {
        throw new Error('PG client configuration required');
    }

    /**
     * Store in module.
     *
     * @todo  Figure out a better way to do this.
     */
    config = clientConfig;
}

/**
 * Get view data from a table's name.
 *
 * @param  {string}  tableName
 * @return {Promise}           Resolves to an array of 'view data' objects
 */
function getViewDataFromTableName(tableName) {
    return getConnectedClient()
        .then(getDependentViewsFromTableName.bind(null, tableName))
        .then(removeEmptiesAndDuplicates)
        .then(mapViewNamesToViewData)
        .finally(closeClient);
}

/**
 * Get view data from view's name.
 *
 * @param  {string}  viewName
 * @return {Promise}          Resolves to an array of 'view data' objects
 */
function getViewDataFromViewName(viewName) {
    return getConnectedClient()
        .then(getDependentViewsFromViewName.bind(null, viewName))
        .then(removeEmptiesAndDuplicates)
        .then(mapViewNamesToViewData)
        .finally(closeClient);
}

module.exports = {
    getViewPermissions: getViewPermissions,
    getViewData: getViewData,
    getDependentViewsFromTableName: getDependentViewsFromTableName,
    getDependentViewsFromViewName: getDependentViewsFromViewName,
    mapViewNamesToViewData: mapViewNamesToViewData,
    getConnectedClient: getConnectedClient,
    configureClient: configureClient,
    getViewDataFromTableName: getViewDataFromTableName,
    getViewDataFromViewName: getViewDataFromViewName,
};
