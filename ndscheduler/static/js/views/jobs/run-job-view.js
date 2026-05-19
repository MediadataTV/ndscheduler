/**
 * run-job view.
 *
 * @author wenbin@nextdoor.com
 */

require.config({
  paths: {
    'jquery': 'vendor/jquery',
    'underscore': 'vendor/underscore',
    'backbone': 'vendor/backbone',
    'bootstrap': 'vendor/bootstrap',

    'text': 'vendor/text',
    'run-job-modal': 'templates/run-job.html'
  },

  shim: {
    'bootstrap': {
      deps: ['jquery']
    },

    'backbone': {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  }
});

define(['text!run-job-modal',
        'backbone',
        'bootstrap'], function(RunJobModalHtml) {
  'use strict';

  return Backbone.View.extend({
    initialize: function() {
      // Guard: inject modal HTML only once — re-renders of the jobs table call initialize again
      if (!$('#run-job-modal').length) {
        $('body').append(RunJobModalHtml);
      }

      this.bindRunJobConfirmClickEvent();
      this.bindModalPopupEvent();
    },

    /**
     * Bind popup event for run-job modal.
     */
    bindModalPopupEvent: function() {
      $('#run-job-modal').on('show.bs.modal', _.bind(function(e) {
        var customRunButton = $(e.relatedTarget);
        var jobName = customRunButton.attr('data-job-name');
        var jobTask = customRunButton.attr('data-job-task');
        var jobPubargs = customRunButton.attr('data-job-pubargs');

        $('#run-job-name').text(jobName);
        $('#run-job-task').text(jobTask);
        $('#run-job-confirm-button').data('id', customRunButton.data('id'));

        var isMulti = jobTask && jobTask.indexOf('ShellMultiJob') !== -1;

        if (isMulti) {
          // ShellMultiJob: pub_args is [baseArgsArray, multiConfigObject]
          // Show only base command + key names — never dump the full config JSON
          $('#run-job-args-section').hide();
          $('#run-job-multi-section').show();
          try {
            var parsed = JSON.parse(jobPubargs);
            var baseArgs = Array.isArray(parsed) && parsed.length >= 1 ? parsed[0] : [];
            var multiConfig = Array.isArray(parsed) && parsed.length >= 2 ? parsed[1] : {};
            $('#run-job-base-args').text(JSON.stringify(baseArgs));
            var keys = Object.keys(multiConfig);
            $('#run-job-config-keys').html(
              keys.map(function(k) {
                return '<span class="label label-info" style="margin-right:4px">' +
                  _.escape(k) + '</span>';
              }).join(' ')
            );
          } catch (ex) {
            $('#run-job-base-args').text(jobPubargs);
            $('#run-job-config-keys').text('(could not parse config)');
          }
        } else {
          // Normal job: show raw pub_args as before
          $('#run-job-multi-section').hide();
          $('#run-job-args-section').show();
          $('#run-job-pubargs').text(jobPubargs);
        }
      }, this));
    },

    /**
     * Bind click event for run-job-confirm button.
     */
    bindRunJobConfirmClickEvent: function() {
      var runJobButton = $('#run-job-confirm-button').off('click');
      runJobButton.on('click', _.bind(function(e) {
        e.preventDefault();
        var jobId = $(e.target).data('id');
        this.collection.runJob(jobId);
        $('#run-job-modal').modal('hide');
      }, this));
    }
  });
});
