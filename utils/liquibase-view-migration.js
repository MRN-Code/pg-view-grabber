/* jshint node:true */

'use strict';

var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');

var Handlebars = require('handlebars');

var TEMPLATE_PATH = path.resolve(
    __dirname,
    '..',
    'templates',
    'liquibase-view-migration.hbs'
);

/** Save template contents for future use. */
var template;

/** Cache a timestamp for a default migration `id` */
var timestamp = Date.now();

/**
 * Default file name formatter.
 *
 * @param  {Object} filenameOptions
 * @param  {string} filenameOptions.author
 * @param  {string} filenameOptions.id
 * @param  {string} filenameOptions.schema
 * @param  {string} filenameOptions.viewName
 * @return {string}
 */
function getDefaultFilename(filenameOptions) {
    return path.join(
        '.',
        'dist',
        filenameOptions.id + '-' + filenameOptions.viewName + '.xml'
    );
}

/**
 * Get the template file's contents.
 *
 * @return {Promise}
 */
function getTemplate() {
    if (template) {
        return Promise.resolve(template);
    }

    return new Promise(function(resolve, reject) {
        fs.readFile(TEMPLATE_PATH, 'utf8', function(error, contents) {
            if (error) {
                return reject(error);
            }
            template = Handlebars.compile(contents);
            resolve(template);
        });
    });
}

/**
 * Get a Liquibase view migration contents.
 *
 * @param  {object}  options
 * @param  {string}  options.author
 * @param  {string}  options.definition
 * @param  {string}  options.id
 * @param  {string}  options.permissions
 * @param  {string}  options.schema
 * @param  {string}  options.viewName
 * @return {Promise}
 */
function getMigrationContents(options) {
    return getTemplate()
        .then(function(template) {
            return template({
                author: options.author || process.env.USER,
                definition: options.definition,
                id: options.id || timestamp,
                name: options.viewName,
                permissions: options.permissions,
                schema: options.schema,
            });
        }, function(error) {
            console.error(error);
        });
}

/**
 * Save a migration file.
 *
 * @uses getMigrationContents
 *
 * @param  {object}   options
 * @param  {string}   options.author
 * @param  {string}   options.definition
 * @param  {string}   options.id
 * @param  {string}   options.permissions
 * @param  {string}   options.schema
 * @param  {string}   options.viewName
 * @param  {function} [options.formatFilename] Handler to pass to `fs.writeFile`
 * @return {Promise}
 */
function saveMigration(options) {
    return getMigrationContents(options)
        .then(function(migrationContents) {
            var filenameOptions = {
                author: options.author || process.env.USER,
                id: options.id || timestamp,
                schema: options.schema,
                viewName: options.viewName,
            };
            var filename = (
                options.formatFilename &&
                options.formatFilename instanceof Function
            ) ?
                options.formatFilename(filenameOptions) :
                getDefaultFilename(filenameOptions);

            return new Promise(function(resolve, reject) {
                fs.writeFile(filename, migrationContents, function(error) {
                    if (error) {
                        return reject(error);
                    }
                    resolve();
                });
            });
        }, function(error) {
            console.error(error);
        });
}

module.exports = {
    getMigrationContents: getMigrationContents,
    saveMigration: saveMigration,
};
