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
 * Get a Liquibase view migration file.
 *
 * @param  {object}  options
 * @param  {object}  options.author
 * @param  {object}  options.definition
 * @param  {object}  options.id
 * @param  {object}  options.permissions
 * @param  {object}  options.schema
 * @param  {object}  options.viewName
 * @return {Promise}
 */
function getLiquibaseViewMigrationFile(options) {
    return getTemplate()
        .then(function(template) {
            return template({
                author: options.author,
                definition: options.definition,
                id: options.id,
                name: options.viewName,
                permissions: options.permissions,
                schema: options.schema,
            });
        }, function(error) {
            console.error(error);
        });
}

module.exports = getLiquibaseViewMigrationFile;
