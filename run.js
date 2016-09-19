'use strict';
/* jshint node:true */

var pgViewGrabber = require('./index.js');
var Promise = require('bluebird');
var dbConfig = require('/coins/config/dbmap.json');

pgViewGrabber.config({
  database: dbConfig._default.db,
  host: dbConfig.development._default.host,
  password: dbConfig._apps.mrs.password,
  port: dbConfig._default.port,
  user: dbConfig._apps.mrs.username,
});


let getAllDependenciesFromArray = (names) => {
    return Promise.all(
      names.map(name => {
        // this will get ALL dependencies (even if they are multiple layers deep)
        let dep = pgViewGrabber.getDependencies({
          name: name
        });

        return Promise.all([name, dep]);
      })
    );
}

let getDependenciesOfDependencies = (results) => {
  let nonUniqueDependencies = [];

  for (let result of results) {
    nonUniqueDependencies = nonUniqueDependencies.concat(result[1]);
  }

  let uniqueDependencies = Array.from(new Set(nonUniqueDependencies));

  return uniqueDependencies;
}

let convertUglyArrayToPrettyObject = (results) => {
  let dependencyArray = [];

  for (let result of results) {
    dependencyArray.push({
      name: result[0],
      deps: result[1],
    });
  }

  return dependencyArray;
}

let determineDropOrder = (results, dropOrder = []) => {
  let depsArr = [];

  //console.log('original results:');
  //console.log(results);

  function removeFromDepLists(name) {
    function removeIndex(arr) {
      let index = arr.deps.indexOf(name);
      if (index !== -1) {
        // remove index from array
        arr.deps.splice(index, 1);
      }
    }

    results.map(removeIndex);
    depsArr.map(removeIndex);
  }

  for (let result of results) {
    if (result.deps.length === 0) {
      dropOrder.push(result.name);
      removeFromDepLists(result.name);
    } else {
      depsArr.push(result);
    }
  }

  if (depsArr.length !== 0) {
    dropOrder = determineDropOrder(depsArr, dropOrder);
  }

  return dropOrder;
}

// fwd
//let names = ['dx_data_requests_sources_hist','dx_data_requests','dx_data_requests_sources_hist','fake','dx_subjects_vw'];

// rev
//let names = ['dx_subjects_vw','fake','dx_data_requests_sources_hist','dx_data_requests','dx_data_requests_sources_hist'];

// 65 tables
let names = ['cas_study_user_role_privs','cas_study_user_role_privs_hist','dx_asmts_mv','dx_data_requests_sources','dx_data_requests_sources_hist','dx_data_requests_target_studies','dx_data_requests_target_studies_hist','dx_series_mv','dx_studies_mv','dx_subjects_mv','dx_usage_agreements','dx_usage_agreements_hist','may_5_and_after_asmts__hist','may_5_and_after_asmts_hist_2','may_5_conflict_resolution_audit','may_5_conflict_resolution_audit_2','mrs_analysis_quicklook_statistic','mrs_analysis_quicklook_statistic_hist','mrs_analysis_sub_study','mrs_assessments','mrs_assessments_hist','mrs_charge_code_study_details','mrs_charge_code_study_details_hist','mrs_data_domains','mrs_data_domains_hist','mrs_document_categories','mrs_eeg_sessions','mrs_eeg_sessions_hist','mrs_eeg_study_tasks','mrs_eeg_study_tasks_hist','mrs_file_record_participant_details','mrs_file_record_participant_details_hist','mrs_instrument_question_score','mrs_legacy_sharing_rules','mrs_legacy_sharing_rules_hist','mrs_legacy_sharing_rules_studies','mrs_legacy_sharing_rules_studies_hist','mrs_missing_assessment_reasons_hist','mrs_person_role_details','mrs_person_role_details_hist','mrs_proj_study_details','mrs_proj_study_det_hist','mrs_purchase_requests','mrs_purchase_requests_hist','mrs_scan_sessions_hist','mrs_series_labels','mrs_series_labels_hist','mrs_sharing_rules','mrs_sharing_rules_hist','mrs_sharing_rules_studies','mrs_sharing_rules_studies_hist','mrs_studies','mrs_studies_hist','mrs_studies_researc_areas_hist','mrs_studies_research_areas','mrs_study_codes','mrs_study_codes_hist','mrs_study_demo_config','mrs_study_missing_assessment_reasons','mrs_study_recruitment_criteria','mrs_study_recruitment_criteria_hist','mrs_subject_types','mrs_subject_types_hist','mrs_trgt_enrllmnt_temp','olingrants'];

// output an ordered list that will give the drop order for all views that are (recursively) dependent on the tables listed in the names variable
let results = getAllDependenciesFromArray(names)
  .then(getDependenciesOfDependencies)
  .then(getAllDependenciesFromArray)
  .then(convertUglyArrayToPrettyObject)
  .then(determineDropOrder)
  .then((res) => {
    console.log(res);
  });

