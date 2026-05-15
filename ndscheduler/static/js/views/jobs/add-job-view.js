/**
 * add-job view.
 *
 * @author wenbin@nextdoor.com
 */

require.config({
  paths: {
    'jquery': 'vendor/jquery',
    'underscore': 'vendor/underscore',
    'backbone': 'vendor/backbone',
    'bootstrap': 'vendor/bootstrap',
    'select2': 'vendor/select2',

    'utils': 'utils',

    'text': 'vendor/text',
    'add-job-modal': 'templates/add-job.html',
    'job-class-notes': 'templates/job-class-notes.html'
  },

  shim: {
    'bootstrap': {
      deps: ['jquery']
    },

    'select2': {
      deps: ['jquery']
    },

    'backbone': {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  }
});

define(['utils',
  'text!add-job-modal',
  'text!job-class-notes',
  'backbone',
  'bootstrap',
  'select2'], function(utils, AddJobModalHtml, JobClassNotesHtml) {

  'use strict';

  return Backbone.View.extend({

    // Holds the JSONEditor instance for the Multi Config field
    multiConfigEditor: null,

    initialize: function() {

      $('body').append(AddJobModalHtml);
      this.bindAddJobConfirmClickEvent();

      var self = this;
      var jobsMetaInfo = $.parseJSON($('#jobs-meta-info').html());
      var data = [];
      _.forEach(jobsMetaInfo, function(job) {
        data.push({
          id: job.job_class_string,
          text: job.job_class_string,
          job: job
        })
      });
      $('#input-job-task-class').select2({
        placeholder: "Select an job class, please",
        data: data
      }).on("select2-selecting", function(e) {
        $('#add-job-class-notes').html(
            _.template(JobClassNotesHtml)({job: e.choice.job})
        );
        if (e.choice.id.indexOf('ShellMultiJob') !== -1) {
          $('#add-multi-config-group').show();
          $('#input-job-task-args').val('[]');
          // Init JSONEditor lazily the first time the section is shown
          if (!self.multiConfigEditor) {
            self.multiConfigEditor = new JSONEditor(
              document.getElementById('input-job-multi-config-editor'),
              {
                mode: 'code',
                modes: ['code', 'tree'],
                name: 'multi_config',
                onError: function(err) { utils.alertError('JSON error: ' + err.toString()); }
              }
            );
            self.multiConfigEditor.set({});
          }
        } else {
          $('#add-multi-config-group').hide();
        }
      });
    },

    bindAddJobConfirmClickEvent: function() {
      var self = this;
      $('#add-job-confirm-button').on('click', _.bind(function(e) {
        e.preventDefault();

        var jobName = $('#input-job-name').val();
        var jobTask = $('#input-job-task-class').val();
        var month = $('#input-job-month').val();
        var dayOfWeek = $('#input-job-day-of-week').val();
        var day = $('#input-job-day').val();
        var hour = $('#input-job-hour').val();
        var minute = $('#input-job-minute').val();
        var args = $('#input-job-task-args').val();

        if (!$.trim(jobName)) {
          utils.alertError('Please fill in job name');
          return;
        }

        if (!$.trim(jobTask)) {
          utils.alertError('Please fill in job task class');
          return;
        }

        if (jobName.indexOf('$') != -1 ||
            jobTask.indexOf('$') != -1 ||
            args.indexOf('$') != -1) {
          utils.alertError('You cannot use "$". Please remove it.');
          return;
        }

        var isShellMulti = (jobTask.indexOf('ShellMultiJob') !== -1);

        var taskArgs = [];
        try {
          taskArgs = utils.getTaskArgs(args);
        } catch (err) {
          utils.alertError('Invalid Arguments. Should be valid JSON string,' +
              ' e.g., [1, 2, "hello"].');
          return;
        }

        if (isShellMulti) {
          if (!self.multiConfigEditor) {
            utils.alertError('Multi Config editor not initialized. Please re-select the job class.');
            return;
          }
          var multiConfig;
          try {
            multiConfig = self.multiConfigEditor.get();
          } catch (err) {
            utils.alertError('Multi Config contains invalid JSON: ' + err.toString());
            return;
          }
          if (typeof multiConfig !== 'object' || Array.isArray(multiConfig) || multiConfig === null) {
            utils.alertError('Multi Config must be a JSON object (not an array).');
            return;
          }
          // pub_args = [baseArgsArray, multiConfigObject]
          taskArgs = [taskArgs, multiConfig];
        }

        this.collection.addJob({
          job_class_string: jobTask,
          name: jobName,
          pub_args: taskArgs,
          month: month,
          day_of_week: dayOfWeek,
          day: day,
          hour: hour,
          minute: minute
        });

        $('#add-job-modal').modal('hide');
      }, this));
    }
  });
});
