/* jshint node:true */

'use strict';

var ACTIONS = [
    'INSERT',
    'SELECT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
];

/**
 * Does a privileges list contain all priveleges?
 *
 * @param  {string}  priveleges
 * @return {boolean}
 */
function hasAllPrivileges(priveleges) {
    return ACTIONS.every(function(action) {
        return priveleges.indexOf(action) !== -1;
    });
}

module.exports = hasAllPrivileges;
