/* jshint node:true */

'use strict';

var assign = require('object-assign');
var path = require('path');
var Promise = require('bluebird');

var liquibaseViewMigration = require('./utils/liquibase-view-migration.js');
var dbOperations = require('./utils/db-operations');

/**
 * Handle migration tasks.
 *
 * Function for both view and table migration files saving and `get`-ing.
 *
 * @param  {Object}   options
 * @param  {string}   options.name             Name of the table or view to
 *                                             target
 * @param  {string}   [options.author]
 * @param  {function} [options.formatFilename] Formatter function for migration
 *                                             files' names.
 * @param  {string}   [options.id=Date.now()]
 * @param  {boolean}  [options.isTable=true]
 * @param  {boolean}  [options.saveFiles=false]
 * @return {Promise}
 */
function doMigration(options) {
    if (!('isTable' in options)) {
        options.isTable = true;
    }
    if (!('saveFiles' in options)) {
        options.saveFiles = false;
    }

    var author = options.author;
    var formatFilename = options.formatFilename;
    var id = options.id;
    var name = options.name;
    var operator = options.isTable ?
        dbOperations.getViewDataFromTableName :
        dbOperations.getViewDataFromViewName;
    var processor = options.saveFiles ?
        liquibaseViewMigration.saveMigration :
        liquibaseViewMigration.getMigrationContents;

    return operator(name)
        .then(function(viewDatas) {
            if (!Array.isArray(viewDatas)) {
                return Promise.resolve();
            }

            return Promise.all(viewDatas.map(function(viewData) {
                var migrationOptions = assign({}, viewData, {
                    author: author,
                    formatFilename: formatFilename,
                    id: id,
                });

                return processor(migrationOptions);
            }));
    });
}

/**
 * Get migration templates for a table.
 *
 * @see doMigration
 *
 * @param  {Object}  options
 * @param  {string}  options.name Table's name
 * @return {Promise}
 */
function getTableMigration(options) {
    return doMigration(assign({}, options, {
        isTable: true,
        saveFiles: false,
    }));
}

/**
 * Get dependencies for a table
 *
 * @param  {Object}  options
 * @param  {string}  options.name Table's name
 * @return {Promise}
 */
function getDependencies(options) {
    let name = options.name;
    let operator = dbOperations.getDependenentViewsFromTableName;

    return operator(name)
        .then(function(viewDatas) {
            if (!Array.isArray(viewDatas)) {
                return Promise.resolve();
            }

            return Promise.all(viewDatas.map(function(viewData) {
                return viewData;
            }));
    });
}

/**
 * Get migration templates for a view.
 *
 * @see doMigration
 *
 * @param  {Object}  options
 * @param  {string}  options.name View's name
 * @return {Promise}
 */
function getViewMigration(options) {
    return doMigration(assign({}, options, {
        isTable: false,
        saveFiles: false,
    }));
}

/**
 * Save migration files for a table.
 *
 * @see doMigration
 *
 * @param  {Object}  options
 * @param  {string}  options.name Table's name
 * @return {Promise}
 */
function saveTableMigration(options) {
    return doMigration(assign({}, options, {
        isTable: true,
        saveFiles: true,
    }));
}

/**
 * Save migration files for a view.
 *
 * @see doMigration
 *
 * @param  {Object}  options
 * @param  {string}  options.name View's name
 * @return {Promise}
 */
function saveViewMigration(options) {
    return doMigration(assign({}, options, {
        isTable: false,
        saveFiles: true,
    }));
}

module.exports = {
    config: dbOperations.configureClient,
    fromTable: dbOperations.getViewDataFromTableName,
    fromView: dbOperations.getViewDataFromViewName,
    getTableMigration: getTableMigration,
    getDependencies: getDependencies,
    getViewMigration: getViewMigration,
    saveTableMigration: saveTableMigration,
    saveViewMigration: saveViewMigration,
};
