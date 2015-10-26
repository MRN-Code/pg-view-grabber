/* jshint node:true */

'use strict';

var assign = require('object-assign');
var path = require('path');

var liquibaseViewMigration = require('./utils/liquibase-view-migration.js');
var dbOperations = require('./utils/db-operations');

/**
 * Save migration files.
 *
 * Function for both view and table migration files.
 *
 * @param  {Object}   options
 * @param  {string}   options.name             Name of the table or view to
 *                                             target
 * @param  {string}   [options.author]
 * @param  {function} [options.formatFilename] Formatter function for migration
 *                                             files' names.
 * @param  {string}   [options.id=Date.now()]
 * @param  {boolean}  [options.isTable=true]
 * @return {Promise}
 */
function saveMigrationFiles(options) {
    if (!('isTable' in options)) {
        options.isTable = true;
    }

    var author = options.author;
    var formatFilename = options.formatFilename;
    var id = options.id;
    var name = options.name;
    var operator = options.isTable ?
        dbOperations.getViewDataFromTableName :
        dbOperations.getViewDataFromViewName;

    return operator(name)
        .then(function(viewDatas) {
            return Promise.all(viewDatas.map(function(viewData) {
                var migrationOptions = assign({}, viewData, {
                    author: author,
                    formatFilename: formatFilename,
                    id: id,
                });

                return liquibaseViewMigration.saveMigration(migrationOptions);
            }));
    });
}

/**
 * Save migration files for a table.
 *
 * @see saveMigrationFiles
 *
 * @param  {Object}  options
 * @param  {string}  options.name Table's name
 * @return {Promise}
 */
function saveTableMigration(options) {
    return saveMigrationFiles(assign({}, options, { isTable: true }));
}

/**
 * Save migration files for a view.
 *
 * @see saveMigrationFiles
 *
 * @param  {Object}  options
 * @param  {string}  options.name View's name
 * @return {Promise}
 */
function saveViewMigration(options) {
    return saveMigrationFiles(assign({}, options, { isTable: false }));
}

module.exports = {
    config: dbOperations.configureClient,
    fromTable: dbOperations.getViewDataFromTableName,
    fromView: dbOperations.getViewDataFromViewName,
    saveTableMigration: saveTableMigration,
    saveViewMigration: saveViewMigration,
};
