/**
 * edit-job view.
 *
 * @author wenbin@nextdoor.com
 */

require.config({
  paths: {
    'jquery': 'vendor/jquery',
    'underscore': 'vendor/underscore',
    'backbone': 'vendor/backbone',
    'bootstrap': 'vendor/bootstrap',
    'bootstrapswitch': 'vendor/bootstrap-switch',

    'utils': 'utils',

    'text': 'vendor/text',
    'edit-job-modal': 'templates/edit-job.html',
    'job-class-notes': 'templates/job-class-notes.html'
  },

  shim: {
    'bootstrapswitch': {
      deps: ['bootstrap']
    },

    'bootstrap': {
      deps: ['jquery']
    },

    'backbone': {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  }
});

define(['utils',
        'text!edit-job-modal',
        'text!job-class-notes',
        'backbone',
        'bootstrapswitch'], function(utils, EditJobModalHtml, JobClassNotesHtml) {

  'use strict';

  return Backbone.View.extend({

    // Holds the JSONEditor instance for the Multi Config field
    multiConfigEditor: null,

    initialize: function() {
      $('body').append(EditJobModalHtml);

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
      $('#edit-input-job-task-class').select2({
        data: data
      }).on("select2-selecting", function(e) {
        $('#edit-job-class-notes').html(
            _.template(JobClassNotesHtml)({job: e.choice.job})
        );
        if (e.choice.id.indexOf('ShellMultiJob') !== -1) {
          $('#edit-multi-config-group').show();
          self._ensureEditEditor();
        } else {
          $('#edit-multi-config-group').hide();
        }
      });

      this.bindEditJobConfirmClickEvent();
      this.bindDeleteJobConfirmClickEvent();
      this.bindModalPopupEvent();
    },

    // Create the JSONEditor for the edit modal if it does not exist yet
    _ensureEditEditor: function() {
      if (!this.multiConfigEditor) {
        this.multiConfigEditor = new JSONEditor(
          document.getElementById('edit-input-job-multi-config-editor'),
          {
            mode: 'code',
            modes: ['code', 'tree'],
            name: 'multi_config',
            onError: function(err) { utils.alertError('JSON error: ' + err.toString()); }
          }
        );
        this.multiConfigEditor.set({});
      }
    },

    /**
     * Bind click event for delete-job button.
     */
    bindDeleteJobConfirmClickEvent: function() {
      var $button = $('#delete-job-confirm-button');
      $button.off('click');
      $button.on('click', _.bind(function() {
        if (confirm('Really want to delete it?')) {
          var jobId = $('#edit-input-job-id').val();
          this.collection.deleteJob(jobId);
          $('#edit-job-modal').modal('hide');
        }
      }, this));
    },

    /**
     * Bind popup event for edit-job modal.
     */
    bindModalPopupEvent: function() {
      $('#edit-job-modal').on('show.bs.modal', _.bind(function(e) {
        var $button = $(e.relatedTarget);
        var jobId = $button.data('id');
        var jobActive = $button.data('job-active');
        var jobClass = $button.data('job-task');

        $('#edit-input-job-name').val($button.data('job-name'));
        $('#edit-input-job-task-class').val(jobClass).trigger('change');
        $('#edit-input-job-month').val($button.data('job-month'));
        $('#edit-input-job-day-of-week').val($button.data('job-day-of-week'));
        $('#edit-input-job-day').val($button.data('job-day'));
        $('#edit-input-job-hour').val($button.data('job-hour'));
        $('#edit-input-job-minute').val($button.data('job-minute'));
        $('#edit-input-job-id').val(jobId);

        var rawPubArgs = $button.attr('data-job-pubargs');

        if (jobClass && jobClass.indexOf('ShellMultiJob') !== -1) {
          $('#edit-multi-config-group').show();
          this._ensureEditEditor();
          try {
            var parsed = JSON.parse(rawPubArgs);
            if (Array.isArray(parsed) && parsed.length === 2) {
              $('#edit-input-job-task-args').val(JSON.stringify(parsed[0]));
              this.multiConfigEditor.set(parsed[1]);
            } else {
              $('#edit-input-job-task-args').val(rawPubArgs);
              this.multiConfigEditor.set({});
            }
          } catch (err) {
            $('#edit-input-job-task-args').val(rawPubArgs);
            this.multiConfigEditor.set({});
          }
        } else {
          $('#edit-multi-config-group').hide();
          $('#edit-input-job-task-args').val(rawPubArgs);
        }

        var $checkbox = $('<input>', {
          type: 'checkbox',
          name: 'pause-resume-checkbox',
          id: 'pause-resume-checkbox',
          checked: ''
        });
        $('#pause-resume-container').html($checkbox);
        $("[name='pause-resume-checkbox']").bootstrapSwitch({
          'onText': 'Active',
          'offText': 'Inactive',
          'state': (jobActive == 'yes'),
          'onSwitchChange': _.bind(function(event, state) {
            if (state) {
              this.collection.resumeJob(jobId);
            } else {
              this.collection.pauseJob(jobId);
            }
            $('#edit-job-modal').modal('hide');
          }, this)
        });
      }, this));
    },

    /**
     * Bind click event for edit-job modal.
     */
    bindEditJobConfirmClickEvent: function() {
      var self = this;
      var editConfirmButton = $('#edit-job-confirm-button').off('click');
      editConfirmButton.on('click', _.bind(function(e) {
        e.preventDefault();

        var jobId = $('#edit-input-job-id').val();
        var jobName = $('#edit-input-job-name').val();
        var jobTask = $('#edit-input-job-task-class').val();
        var month = $('#edit-input-job-month').val();
        var dayOfWeek = $('#edit-input-job-day-of-week').val();
        var day = $('#edit-input-job-day').val();
        var hour = $('#edit-input-job-hour').val();
        var minute = $('#edit-input-job-minute').val();
        var args = $('#edit-input-job-task-args').val();

        if (jobName.trim() === '') {
          utils.alertError('Please fill in job name');
          return;
        }

        if (jobTask.trim() === '') {
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

        var taskArgs = undefined;
        try {
          taskArgs = utils.getTaskArgs(args);
        } catch (err) {
          utils.alertError('Invalid Arguments. Should be valid JSON string,' +
              ' e.g., [1, 2, "hello"].');
          return;
        }

        if (isShellMulti) {
          if (!self.multiConfigEditor) {
            utils.alertError('Multi Config editor not initialized.');
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
          taskArgs = [taskArgs, multiConfig];
        }

        this.collection.modifyJob(jobId, {
          job_class_string: jobTask,
          name: jobName,
          pub_args: taskArgs,
          month: month,
          day_of_week: dayOfWeek,
          day: day,
          hour: hour,
          minute: minute
        });

        $('#edit-job-modal').modal('hide');
      }, this));
    }
  });
});
