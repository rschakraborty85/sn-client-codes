/** wsdSearchFilter Directive - customized
 *
 * Search filter directive. responsible for search execution and filtering reservable
 * Custom type definitions can be found at the bottom of the file.
 * @param {*} $timeout
 * @param {wsdUtils} wsdUtils
 * @param {wsdStateService} wsdStateService
 * @param {wsdReservableSearch} wsdReservableSearch
 */
function wsdSearchFilter(
  $timeout,
  wsdUtils,
  wsdStateService,
  wsdReservableSearch,
  wsdReservableMappingService,
  wsdShiftService,
  $http,
  spUtil
) {
  var DURATION_TYPES = {
    until: "until",
    count: "for",
  };

  return {
    restrict: "E",
    scope: {
      mode: "=?",
      reservation: "=?",
      start: "=?",
      end: "=?",
      dayStart: "=?",
      dayEnd: "=?",
      pageSize: "=?",
      initConfig: "=?",
      isMultiItemSelection: "=?",
      disableChangeLocation: "=",
      disableChangeModule: "=",
    },
    controller: [
      "$scope",
      function ($scope) {
        // Moved to controller else the directive receiving the repeatsSelect2Options was getting undefined
        // and moving it to here seemed to fix it
        // Recurring repeat choices
        var repeatChoices = [
          {
            id: "daily",
            text: "${Daily}",
          },
          {
            id: "weekly",
            text: "${Weekly}",
          },
          {
            id: "monthly",
            text: "${Monthly}",
          },
        ];
        $scope.repeatsSelect2Options = {
          data: repeatChoices,
          minimumResultsForSearch: 0,
        };
        $scope.recurringRepeats = "daily";

        // Recurring duration choices
        var durationChoices = [
          {
            id: DURATION_TYPES.count,
            text: "${For}",
          },
          {
            id: DURATION_TYPES.until,
            text: "${Until}",
          },
        ];
        $scope.recurringDurationSelect2Options = {
          data: durationChoices,
          minimumResultsForSearch: 0,
          formatResult: buildRecurringDurationTemplate,
          formatSelection: buildRecurringDurationTemplate,
        };
        $scope.recurringDurationType = "for";

        /**
         * Builds the html for the recurring duration options
         * @param {RecurringDurationOption} element
         * @returns {string}
         */
        function buildRecurringDurationTemplate(element) {
          // Needs inline style because the select2 is rendered outside our widget, so we cannot style it through CSS.
          return wsdUtils.formatString(
            '<span title="{0}" aria-label="{0}" style="text-transform: capitalize">{0}</span>',
            element.text
          );
        }
      },
    ],
    link: function (scope) {
      var DEFAULT_PAGE_SIZE = 8;
      var RESERVABLE_MODULE_ACTIVE_EQ =
        "active=true^active_from<=javascript:gs.endOfToday()^ORactive_fromISEMPTY";
      var FILTER_FIELDS = [
        "reservable_module.value",
        "building.value",
        "start.value",
        "end.value",
        "recurringEnd.value",
        "isRecurring",
        "isRecurring.value",
        "occurrenceCount",
        "recurringDays",
        "recurringRepeats",
        "recurringDurationType",
        "shiftStart.value",
        "selectedShift.value",
        "shiftRecurringEnd.value",
      ];

      var RSV_DATE_TIME_TYPE = {
        start: "start",
        end: "end",
        recurringEnd: "recurringEnd",
      };
      var DEFAULT_DAY_START = "08:00"; // RC - changed
      var DEFAULT_DAY_END = "18:00";
      // RC - change start
      var BUILDING_PICKER_DEFAULT_EQ = "active=true^is_reservable=true";
      // RC - change end
      var watchers = [];
      var timeout = $timeout(function () {});
      var dateTimeFormat = wsdUtils.getDateTimeFormat();
      var dateFormat = wsdUtils.getDateFormat();
      // RC - changed
      // always set next day as default
      var now = moment().seconds(0).milliseconds(0);
      var currentHour = moment().hours();
      //console.log("RC wsd directive now is " + moment().hours());
      var nowMorning = moment(now.format(dateFormat) + " " + DEFAULT_DAY_START);
      var tomorrowInSec = moment().add(1, "d").seconds(0).milliseconds(0);
      var tomorrow = moment(
        tomorrowInSec.format(dateFormat) + " " + DEFAULT_DAY_START
      );
      var reserveMaxDays = null;
      // RC - end
      var _nextItemIndex = null;
      var selectedReservableModule = null;
      var previousBuilding = null;
      var previousModule = null;
      // RC - changed logic below
      var considerThisTime = nowMorning;
      if (currentHour >= 17) considerThisTime = tomorrow;
      var suggestedStart = wsdUtils
        .roundUpDateTime(moment(considerThisTime))
        // .roundUpDateTime(tomorrow)
        .format(dateTimeFormat);

      var lockEndTimeValidation = false; // control whether the end time will be validated

      // RC - added new , used in time change function
      var initEndTime = "";
      // all day setting
      scope.enableAllDayOption = false;
      scope.isAllDay = false;

      // notification
      scope.searchNotificationConfig = {};
      scope.showSearchNotification = false;
      scope.hasSearched = false;
      //RC - added
      scope.notificationTypeRc = "";
      scope.searchNotificationConfigRc = {};
      scope.showSearchNotificationRc = false;

      scope.moduleChange = moduleChange;
      scope.buildingChange = buildingChange;
      scope.shiftChange = shiftChange;
      scope.triggerCalcOccurrences = triggerCalcOccurrences;
      scope.toggleAllDay = toggleAllDay;
      scope.isEndDateDisabled = isEndDateDisabled;
      scope.reservedReservables = [];
      scope.isLoading = false;
      scope.reservableModulePickerEQ = RESERVABLE_MODULE_ACTIVE_EQ;
      scope.buildingPickerEQ = BUILDING_PICKER_DEFAULT_EQ; // RC - changed
      scope.hasSelectedShift = hasSelectedShift;
      scope.onShiftStartChange = onShiftStartChange;
      scope.recurringShiftTimeValidation = recurringShiftTimeValidation;
      scope.onIsRecurringChanged = onIsRecurringChanged;

      scope.isRecurring = {
        value: false,
      }; // intentionally nested in an object, because the reference with a primitive object doesnt work wel for ngModel of type bool

      scope.amountOfOccurrences = 0;
      scope.occurrenceCount = 2;
      scope.recurringDays = "";
      scope.recurringEvery = 1;
      scope.recurringEnd = {};

      scope.enableRecurring = false; // RC - disabled
      scope.canSearch = false;

      scope.shiftStart = null;
      scope.shiftEnd = null;
      scope.selectedShift = null;

      _init();

      function _init() {
        scope.pageSize = scope.pageSize ? scope.pageSize : DEFAULT_PAGE_SIZE;
        scope.timeChange = timeChange;
        scope.searchHandler = searchHandler;
        scope.isEditing = scope.mode === "edit";

        scope.dayStart = scope.dayStart || DEFAULT_DAY_START;
        scope.dayEnd = scope.dayEnd || DEFAULT_DAY_END;

        _prepareForMode(scope.isEditing, scope.reservation);
        _createTriggerSearchWatcher();
        _prepareWatchers();
        wsdStateService.setState("searchWasAuto", false);
      }
      // breakpoint
      // RC - custom notification function
      // idea is to make msg persistent

      function _showNotificationDiffTz(msg, type, icon, templateType) {
        scope.searchNotificationConfigDiffTz = {
          msg: msg,
          type: type,
          icon: icon,
        };
        scope.showSearchNotificationDiffTz = true;
      }

      function _showNotificationMaxDays(msg, type, icon, templateType) {
        scope.searchNotificationConfigMaxDays = {
          msg: msg,
          type: type,
          icon: icon,
        };
        scope.showSearchNotificationMaxDays = true;
      }
      /**
       * RC - changed definition - changed onload logic
       * check initial config (based on last search) and prefill filter data when applicable
       * @param {SearchRequest} initConfig - last search request config
       * @private
       */
      function _fetchFilterInformationFromConfig(initConfig) {
        if (_.isEmpty(initConfig)) return;
        var selectSeat = "";
        if (initConfig.building) {
          scope.building = {
            name: "building",
            value: initConfig.building.sys_id,
            displayValue: initConfig.building.display_value,
          };

          selectSeat = initConfig.building.area_select_seat;
          if (initConfig.time_zone_info) {
            var tmpObj = initConfig.time_zone_info;
            if (
              tmpObj.building_tz != "" &&
              tmpObj.user_tz != tmpObj.building_tz
            ) {
              // spUtil.addTrivialMessage(tmpObj.warning_msg);
              // spUtil.addInfoMessage(tmpObj.warning_msg);
              $timeout(function () {
                _showNotificationDiffTz(
                  tmpObj.warning_msg,
                  "alert-warning",
                  "fa-info-circle",
                  "diff_tz"
                );
              }, 1000);
            }
          }
        }

        if (initConfig.reservable_module) {
          scope.reservable_module = {
            name: "reservable_module",
            value: initConfig.reservable_module.sys_id,
            displayValue: initConfig.reservable_module.display_value,
          };
          scope.shiftMode = initConfig.reservable_module.apply_to_shift;
          // RC - add filter on load
          if (selectSeat)
            scope.reservableModulePickerEQ +=
              "^reservable_filterLIKEarea.u_select_seat=true";
          else if (!selectSeat)
            scope.reservableModulePickerEQ +=
              "^reservable_filterLIKEarea.u_select_seat=false";

          // show notification wont work on load
          // not sure why - now i know ; its cause of the amount of time the page takes to load
          // solution is to delay it by at least a full second
          // $timeout.cancel(timeout);

          if (
            initConfig.reservable_module.max_days_in_future &&
            initConfig.reservable_module.max_days_in_future > 0
          ) {
            reserveMaxDays = parseInt(
              initConfig.reservable_module.max_days,
              10
            );
            var onloadMsg = initConfig.reservable_module.reserve_module_msg;
            // "Reservations can only be made " +
            // initConfig.reservable_module.max_days_in_future +
            // " in advance of the day you want to reserve a space, " +
            // "and only one reservation can be active each day";
            $timeout(function () {
              _showNotificationMaxDays(
                onloadMsg,
                "alert-info",
                "fa-info-circle",
                "reserve_max_days"
              );
            }, 1000);
          } else {
            // scope.showSearchNotificationRc = false;
          }

          // see if spUtil message works well here - breakpoint
          // spUtil.addInfoMessage("TEST How does it look ?");

          moduleChange(scope.reservable_module); // manually trigger as its starting up with reservable module
        }

        if (initConfig.shift) {
          scope.selectedShift = {
            name: "shift",
            value: initConfig.shift.sys_id,
            displayValue: initConfig.shift.display_value,
            shiftDetails: initConfig.shift.shiftDetails,
          };
          scope.recurringDurationType = DURATION_TYPES.until;
          shiftChange(scope.selectedShift, true);
        }
      }
      /**
       * Handles change on building
       * RC - changed purpose , moved function up
       */
      function buildingChange() {
        scope.selectedShift = {
          value: "",
        };
        // RC - change - start
        var buildingSysId = scope.building.value;

        if (!buildingSysId) {
          scope.reservable_module.displayValue = "";
          scope.reservable_module.value = "";
          scope.showSearchNotificationMaxDays = false;
          return;
        }

        scope.showSearchNotificationMaxDays = false;

        var url =
          "/api/sn_wsd_rsv/search/building_extra?building_sys_id=" +
          buildingSysId;

        $http.get(url).then(function (response) {
          if (response.status !== 200)
            _showNotification(
              "${Something went wrong while trying to load building information}",
              "alert-warning",
              "fa-exclamation-triangle"
            );

          var shortObj = response.data.result.user_building_tz;
          var userTz = shortObj.user_tz;
          var buildTz = shortObj.building_tz;
          var buildingObj = response.data.result.building_data;
          var selectSeat = buildingObj.area_select_seat;

          // RC - "select seat" hardcoded for now ; temporary solution
          scope.reservable_module.displayValue = "";
          scope.reservable_module.value = "";

          if (selectSeat)
            scope.reservableModulePickerEQ =
              RESERVABLE_MODULE_ACTIVE_EQ +
              "^reservable_filterLIKEarea.u_select_seat=true";
          else if (!selectSeat)
            scope.reservableModulePickerEQ =
              RESERVABLE_MODULE_ACTIVE_EQ +
              "^reservable_filterLIKEarea.u_select_seat=false";
          // if building changes ..
          // clear the module value and let user choose again ...
          // RC - breakpoint
          if (buildTz && userTz != buildTz) {
            _showNotificationDiffTz(
              shortObj.warning_msg,
              "alert-warning",
              "fa-info-circle",
              "diff_tz"
            );
            // _showNotification(
            //   shortObj.warning_msg,
            //   "alert-warning",
            //   "fa-exclamation-triangle"
            // );
          } else {
            scope.showSearchNotificationDiffTz = false;
          }
        });
        // RC - change end
      }
      /**
       * RC - changed purpose , moved function up
       * On module change, load the reservable module details and prepare mapping layout
       * @param {SelectOption} module
       */
      function moduleChange(reservableModule) {
        var reservableModuleSysId = reservableModule.value;

        if (!reservableModuleSysId) {
          scope.showSearchNotificationMaxDays = false;
          selectedReservableModule = null;
          wsdStateService.setState("selectedReservableModule", null);
          return;
        }

        if (scope.building && scope.building.value)
          _checkShiftMode(reservableModuleSysId, scope.building.value);

        // load reservable module and prepare mapping
        wsdReservableSearch.getReservableModule(reservableModuleSysId).then(
          function (reservableModule) {
            reservableModule.reservableMapper =
              wsdReservableMappingService.createReservableMapper(
                reservableModule
              );
            selectedReservableModule = reservableModule;
            scope.enableAllDayOption =
              reservableModule.allow_whole_day &&
              !selectedReservableModule.apply_to_shift;
            scope.isAllDay = scope.enableAllDayOption ? scope.isAllDay : false;

            if (
              reservableModule.max_days_in_future &&
              parseInt(reservableModule.max_days_in_future, 10) > 0
            ) {
              reserveMaxDays = parseInt(
                reservableModule.max_days_in_future,
                10
              );
              var onloadMsg =
                "Reservations can only be made " +
                reservableModule.max_days_in_future +
                " in advance of the day you want to reserve a space, " +
                "and only one reservation can be active each day";

              _showNotificationMaxDays(
                onloadMsg,
                "alert-info",
                "fa-info-circle",
                "reserve_max_days"
              );
            } else {
              scope.showSearchNotificationMaxDays = false;
            }

            wsdStateService.setState(
              "selectedReservableModule",
              selectedReservableModule
            );
          },
          function (error) {
            selectedReservableModule = null;
            scope.hasError = true;
            var errorMsg = "${Unable to load and process reservable module}";
            _showNotification(
              errorMsg,
              "alert-danger",
              "fa-exclamation-triangle"
            );
          }
        );
      }

      /**
       * RC - changed
       * On time change it will check if start, end or recurring end time is still valid
       * @param {string} type - can be either: start, end or recurringEnd
       * @return {void}
       */
      function timeChange(type) {
        if (!initEndTime) {
          initEndTime = scope.end.value;
        }

        $timeout.cancel(timeout);
        timeout = $timeout(function () {
          var start = moment(scope.start.value, dateTimeFormat);
          console.log("RC wsd directive start " + start.format(dateTimeFormat));
          var end = moment(scope.end.value, dateTimeFormat);

          if (type === RSV_DATE_TIME_TYPE.start)
            _startTimeValidation(start, end);
          else if (type === RSV_DATE_TIME_TYPE.end)
            _endTimeValidation(start, end);

          var isRecurring =
            !scope.isEditing && scope.isRecurring && scope.isRecurring.value; // isEditing is a safe check (recurring is not pssible on editing)
          if (isRecurring) {
            var recurringEnd =
              scope.recurringEnd && scope.recurringEnd.value
                ? moment(scope.recurringEnd.value, dateTimeFormat)
                : null;
            _recurringEndTimeValidation(start, recurringEnd);
            _calculateAmountOfOccurrences(start, recurringEnd);
          }
        }, 300);
      }

      /**
       * RC - changed
       * Validate the start time of the reservation, e.g., check if it's not in the past
       * @param {Moment} start - start time of the reservation
       * @param {Moment} end - end time of the reservation
       * @private
       */
      function _startTimeValidation(start, end) {
        try {
          if (
            !start.format() ||
            start.format() === "Invalid date" ||
            wsdUtils.isDateInThePast(start)
          ) {
            var timeNow = moment().seconds(0).milliseconds(0);
            scope.start.value = wsdUtils
              .roundUpDateTime(timeNow)
              .format(dateTimeFormat);
            return;
          }

          if (scope.isAllDay) {
            // When all day mode is selected and the start time is not equal to work day start
            // it will deactivate all day reservation.
            var startDate = _getStartOrEndOfDayMmt(start, "dayStart");
            if (
              !start.isSame(startDate, "hour") ||
              !start.isSame(startDate, "minute")
            ) {
              scope.isAllDay = false;
            }
          }

          var newSuggestedEndMmt = _getSuggestedEndMmt(start, end);
          //           console.log(
          //             "RC testing newSuggestedEndMmt is " +
          //               newSuggestedEndMmt.format(dateTimeFormat)
          //           );
          if (!start.isSame(end, "day") || start.isAfter(end)) {
            lockEndTimeValidation = true;
            // RC
            // can be: start is select to different day, start is select to different day and also after dayEnd (when all day is selected)
            scope.end.value = newSuggestedEndMmt.format(dateTimeFormat);
            if (start.isAfter(newSuggestedEndMmt)) {
              // this happens when whole_day is selected -> suggested end is set to: dayEnd value. And start time might still be after the dayEnd value
              scope.start.value = _getStartOrEndOfDayMmt(start, "dayStart");
            }

            return;
          }

          if (start.isSame(end)) {
            if (start.hour() === 23 && start.minute() === 59)
              scope.start.value = end
                .subtract(1, "hour")
                .format(dateTimeFormat);
            else {
              lockEndTimeValidation = true;
              scope.end.value = newSuggestedEndMmt.format(dateTimeFormat);
            }

            return;
          }

          if (start.second() !== 0) {
            scope.start.value = start.second(0).format(dateTimeFormat);
          }

          return;
        } catch (error) {
          //   console.log("ERROR [_startTimeValidation] " + error);
        }
      }

      /**
       * RC - changed
       * Validate the end time of the reservation, e.g., check if it's not in the past
       * @param {Moment} start - start time of the reservation
       * @param {Moment} end - end time of the reservation
       * @private
       */
      function _endTimeValidation(start, end) {
        if (lockEndTimeValidation) {
          // immediately release the lock for end time validation
          lockEndTimeValidation = false;
          return;
        }

        if (
          !end.format() ||
          end.format() === "Invalid date" ||
          wsdUtils.isDateInThePast(end)
        ) {
          scope.end.value = start.add(1, "hour").format(dateTimeFormat);
          return;
        }

        var requireStartChange = false;
        if (!end.isSame(start, "day")) {
          var endOfNextDayMmt = moment(start).add(1, "day").endOf("day");
          // if end is before end of next date of start
          var diff2 = endOfNextDayMmt.diff(end, "hours");
          //           console.log(
          //             "RC testing diff 2 " +
          //               diff2 +
          //               " " +
          //               endOfNextDayMmt.format(dateTimeFormat) +
          //               " " +
          //               reserveMaxDays
          //           );

          var diff = end.diff(start, "hours");
          // if (diff > 0 && diff <= 24) {
          //   return;
          // }
          // below check is for users who needs to search and book for diff dates
          if (diff2 >= 0) return; //&& reserveMaxDays != 1
          // move start to the same day
          start = moment(end)
            .hour(start.hour())
            .minute(start.minute())
            .second(0);
          // RC - research
          requireStartChange = true;
          //   requireStartChange = false;
        }

        if (end.isSame(start) || end.isBefore(start)) {
          var newSuggestedEnd = _getSuggestedEnd(start);
          scope.end.value = newSuggestedEnd;
          scope.start.value = start.format(dateTimeFormat);
          return;
        }

        if (end.second() !== 0)
          scope.end.value = end.second(0).format(dateTimeFormat);

        if (requireStartChange)
          scope.start.value = start.format(dateTimeFormat);

        return;
      }

      /** RC - changed
       * Get the suggested end time (moment) based on start time,
       * default = start + 1 hour, if isAllDay is on, then the scope.dayEnd value will be used
       * @param {Moment} start
       * @return {Moment} suggested end date as moment
       */
      function _getSuggestedEndMmt(start, end) {
        //   getStaticEndTime(start);
        var endVal = scope.isAllDay
          ? _getStartOrEndOfDayMmt(start, "dayEnd")
          : getStaticEndTimeMmt(start);
        //  : start.clone().add(1, "hour");

        return endVal.isSame(start, "day")
          ? endVal
          : start.clone().endOf("day").second(0);
      }

      /**
       * RC - added new functions ; not using right now 13th july
       * Purpose is to always set the end date time at 6pm - temporary hard coded
       * @param {Moment} start pass on the current start time
       */

      function checkIfEndDateIsNextDayBkup(start, end) {
        // check if the current end date time is end of next day max
        // if yes allow search / reservation
        var endOfNextDayMmt = moment(start).add(1, "day").endOf("day");
        // console.log("tmp date is " + endOfNextDayMmt.format(dateTimeFormat));
        var endDiff = endOfNextDayMmt.diff(end, "hours");
        //   console.log(
        //     "find difference between allowed end and chosen end " + endDiff
        //   );
        return endDiff;
      }

      function getStaticEndTimeMmt(start) {
        var startFormatted = moment(start).format(dateTimeFormat);
        var endChanged = startFormatted.replace(
          startFormatted.split(" ")[1].split(":")[0],
          "18"
        );
        return moment(endChanged, dateTimeFormat);
      }

      /**
       * RC changed
       * evaluate whether recurring search can be enabled (not possible in edit mode or in multi-children reservation)
       * @private
       */
      function _evaluateRecurringPossibility() {
        // check recurring posibility
        scope.enableRecurring = !scope.isEditing && !scope.isMultiItemSelection;
        scope.enableRecurring = false;
        if (!scope.enableRecurring) {
          scope.isRecurring.value = false;
        }
      }

      /** RC changed - for end time calculation
       * resolve and prepare filter block for new or editing mode
       * @param {boolean} isEditing - whether the page is loaded in editing mode
       * @param {Reservation} reservation - current reservation if editing mode is on
       * @private
       */
      function _prepareForMode(isEditing, reservation) {
        // NEW SEARCH MODE
        if (!isEditing || !reservation) {
          wsdStateService.setState("settingAutoSearchValues", true);

          var suggestedEnd = wsdUtils
            .roundUpDateTime(moment(considerThisTime).add(10, "hour")) // RC - keep default end on same day
            //.roundUpDateTime(moment(now).add(10, "hour"))
            //.roundUpDateTime(moment(tomorrow).add(10, "hour")) //RC - changed
            .format(dateTimeFormat);
          var suggestedRecurringEndMmt = wsdUtils.roundUpDateTime(
            moment(suggestedEnd).add(1, "month")
          );

          scope.start = {
            value: scope.start || suggestedStart,
          };

          scope.end = {
            value: scope.end || suggestedEnd,
          };
          scope.shiftStart = {
            value: wsdUtils.getDateFromFormattedDateTime(scope.start.value),
          };
          scope.shiftRecurringEnd = {
            value: suggestedRecurringEndMmt.format(dateFormat),
          };
          scope.recurringEnd = {
            value: suggestedRecurringEndMmt.format(dateTimeFormat),
          };

          _fetchFilterInformationFromConfig(scope.initConfig);

          var searchValid = evaluateSearchPossibility();
          scope.canSearch = searchValid.isValid;

          $timeout(function () {
            _attemptAutoSearch(scope.canSearch);
            wsdStateService.setState("settingAutoSearchValues", false);
          }, 100);
          return;
        }

        // EDITING RESERVATION MODE
        scope.start = {
          value: moment(reservation.start).format(dateTimeFormat),
        };
        scope.end = {
          value: moment(reservation.end).format(dateTimeFormat),
        };
        scope.shiftStart = {
          value: moment(reservation.start).format(dateFormat),
        };
        var hasValidFilterInfo = _fetchFilterInformationForEditing(reservation);

        // was not able to load filter information properly due to module or building missing or inactive
        if (!hasValidFilterInfo) return;

        // immediately execute the search
        var searchOption = {
          isPaginationSearch: false,
        };
        // RC - research - one click
        console.log(
          "RC - research - one click - editing mode" +
            JSON.stringify(searchOption)
        );

        searchForAvailableReservables(searchOption);
        scope.canSearch = true;
      }

      /**
       * Below functions are not touched yet - RC
       * ****************************************
       * ****************************************
       * ****************************************
       * ****************************************
       * ****************************************
       */

      /**
       * prepare watcher to watch for scope value change and handle frontend accordingly
       * @private
       */
      function _prepareWatchers() {
        var deregisterGroup = scope.$watchGroup(
          FILTER_FIELDS,
          _handleSearchChange,
          true
        );
        watchers.push(deregisterGroup);

        var deregisterMultiWatch = scope.$watch(
          "isMultiItemSelection",
          function () {
            _evaluateRecurringPossibility();
          },
          true
        );
        watchers.push(deregisterMultiWatch);
      }

      /**
       * If previous search configuration is present and application not in edit mode function performs an automatic search.
       * @param {boolean} canSearch - whether the search param is prepared and valid
       * @private
       */
      function _attemptAutoSearch(canSearch) {
        if (!canSearch) return;

        var dateTimeFormat = wsdUtils.getDateTimeFormat();
        var startDate = moment(scope.start.value, dateTimeFormat).utc();
        var endDate = moment(scope.end.value, dateTimeFormat).utc();
        var autoSearchResultSubTitle = wsdUtils.getStartEndTimeAndDuration(
          startDate,
          endDate
        );

        wsdStateService.setState(
          "autoSearchResultSubTitle",
          autoSearchResultSubTitle
        );

        var searchOption = {
          isPaginationSearch: false,
        };
        searchForAvailableReservables(searchOption).then(function () {
          wsdStateService.setState("searchWasAuto", true, true);
        });
      }

      /**
       * check the editing reservation and prefill filter data when applicable
       * @param {Reservation} reservation - editing reservation
       * @return {boolean}
       * @private
       */
      function _fetchFilterInformationForEditing(reservation) {
        var reservableModule = reservation.reservable_module;

        if (!reservableModule) return false;

        // set reservable module data
        scope.reservable_module = {
          value: reservableModule.sys_id,
          displayValue: reservableModule.name,
          name: "reservable_module",
        };

        // manually trigger the module picker as it's starting up with reservable module
        moduleChange(scope.reservable_module);

        if (reservableModule.reservable_type === "location") {
          if (_isMultiReservation(reservation)) {
            // multi-child location reservation
            scope.reservedReservables = reservation.locations.map(function (
              loc
            ) {
              return String(loc.sys_id);
            });

            // fetch building reservation from the first selected item
            var firstLocation = reservation.locations[0];
            if (!firstLocation.building.active) return false;

            if (!_.isEmpty(firstLocation) && !_.isEmpty(firstLocation.building))
              scope.building = {
                value: firstLocation.building.sys_id,
                displayValue: firstLocation.building.display_value,
              };
          } else {
            // single location reservation
            scope.reservedReservables.push(reservation.location.sys_id);

            if (!reservation.location.building.active) return false;

            if (!_.isEmpty(reservation.location.building))
              scope.building = {
                value: reservation.location.building.sys_id,
                displayValue: reservation.location.u_display_name,
                //RC - commented -> reservation.location.building.display_value,
              };
          }
        }

        // set shift data
        if (!_.isEmpty(reservation.shift)) {
          scope.shiftMode = true;
          scope.selectedShift = {
            name: "shift",
            value: reservation.shift.sys_id,
            displayValue: reservation.shift.display_value,
            shiftDetails: reservation.shift.shiftDetails,
          };

          shiftChange(scope.selectedShift, true);
        }

        return true;
      }

      /**
       * create watcher and listen to trigger search command
       */
      function _createTriggerSearchWatcher() {
        wsdStateService.subscribe(
          "triggerSearch",
          function (old, searchOption) {
            var searchValid = evaluateSearchPossibility();
            if (searchValid.isValid)
              searchForAvailableReservables(searchOption);
            else if (!wsdStateService.getState("searchWasAuto"))
              _showNotification(
                "${Some required fields are missing from search} " +
                  searchValid.fields.join(","),
                "alert-danger"
              );
          }
        );
      }

      /**
       * Trigger the method that will calculate the amount of occurrences based on selected pattern
       * @param {string} [recurringDays] - contains the numeric value of a day when the reservation can occur, for example '45'
       */
      function triggerCalcOccurrences(recurringDays) {
        if (scope.recurringDurationType === DURATION_TYPES.count) return;

        var start = moment(scope.start.value, dateTimeFormat);
        var recurringEnd = moment(scope.recurringEnd.value, dateTimeFormat);
        _calculateAmountOfOccurrences(start, recurringEnd, recurringDays);
      }

      /**
       * handle default new search action
       */
      function searchHandler() {
        wsdStateService.setState("searchWasAuto", false, true);
        _resetReservableFilterData();
        var searchOption = wsdStateService.getState("triggerSearch");
        searchOption = searchOption ? searchOption : {};
        searchOption.isPaginationSearch = false;
        return searchForAvailableReservables(searchOption);
      }

      /**
       * Search for available reservables
       * @returns {Promise}
       */
      function searchForAvailableReservables(searchOption) {
        searchOption = searchOption
          ? searchOption
          : wsdStateService.getState("triggerSearch");
        var searchRequestObj = _constructSearchRequestObj(searchOption);
        var invalidFields = _fetchInvalidFields(searchRequestObj);

        if (searchOption.viewType === "map")
          searchRequestObj.sort_by += ":ignore"; //Save the sorting preference, but don't use it for the map query

        // invalid fields are found, display an error message and stop the search flow.
        if (wsdUtils.arrayHasElement(invalidFields)) {
          scope.hasSearched = true;
          var errorMsg = wsdUtils.formatString(
            "{0}: {1}",
            "${One or more filters are missing}",
            invalidFields.join(", ")
          );
          _showNotification(
            errorMsg,
            "alert-danger",
            "fa-exclamation-triangle"
          );
          return;
        }

        if (scope.showSearchNotification) scope.showSearchNotification = false;

        var recurringPattern = _createRecurringPattern();

        // set state for watchable variables so subscribers can act accordingly.
        wsdStateService.setState("searchRequestObj", searchRequestObj);
        wsdStateService.setState("searchResultHasMore", false);
        wsdStateService.setState("recurringPattern", recurringPattern);
        wsdStateService.setState("resultsDeviate", false);
        wsdStateService.setState(
          "committedSearch",
          _getCurrentSearchValues(true)
        );
        _setSearchIndicatorState(searchOption.isPaginationSearch, true);

        // execute search request and set availableReservables state.
        console.log(
          "RC - one click research " + JSON.stringify(searchRequestObj)
        );
        return wsdReservableSearch
          .getAvailableReservables(searchRequestObj)
          .then(
            function (response) {
              var reservableUnits = response.reservableUnits;
              var reservables =
                wsdStateService.getState("availableReservables") || [];
              var resultHasMore = response.hasMore;

              _nextItemIndex = response.nextItemIndex;
              reservables = searchOption.isPaginationSearch
                ? reservables.concat(reservableUnits)
                : reservableUnits;

              wsdStateService.setState("searchResultHasMore", resultHasMore);
              wsdStateService.setState("availableReservables", reservables);
              wsdStateService.setState("searchResultMsg", "");

              _setSearchReservableFilterState(
                wsdStateService.getState("searchReservableFilter"),
                response.filter,
                reservables
              );
              _setSearchIndicatorState(searchOption.isPaginationSearch, false);
            },
            function (error) {
              _setSearchIndicatorState(searchOption.isPaginationSearch, false);
              var userErrorMsg = "${Could not retrieve workplace items}";
              if (_.has(error, "data.error.message"))
                userErrorMsg = userErrorMsg + ". " + error.data.error.message;

              wsdStateService.setState("searchResultMsg", userErrorMsg);
              wsdStateService.setState("availableReservables", []);
            }
          );
      }

      /**
       * Set the search reservable fitler object
       * @param {ReservableFilter} searchFilterObj
       * @param {ReservableFilter} responseFilter
       * @param {Reservable[]} reservables
       */
      function _setSearchReservableFilterState(
        searchFilterObj,
        responseFilter,
        reservables
      ) {
        if (!searchFilterObj && reservables.length === 0)
          wsdStateService.setState("searchReservableFilter", null);
        else if (searchFilterObj && reservables.length === 0)
          wsdStateService.setState("searchReservableFilter", searchFilterObj);
        else wsdStateService.setState("searchReservableFilter", responseFilter);
      }

      /**
       * construct search request object (set default values when applicable or not given)
       * @param {SearchOption} searchOption - contains view, paging and other information to create search request object
       * @return {SearchRequest} return search request object to send to search API endpoint
       */
      function _constructSearchRequestObj(searchOption) {
        searchOption = searchOption
          ? searchOption
          : {
              isPaginationSearch: false,
            };

        var startUtc;
        var shift;
        var endUtc;
        if (scope.shiftMode) {
          shift = scope.selectedShift.value;
          startUtc = _getShiftStartInUtc(scope.shiftStart.value);
          var endMmt = moment(scope.shiftStart.value, dateFormat).endOf("day");
          endUtc = wsdUtils.getTimeInUtcFromMoment(endMmt);
        } else {
          startUtc = wsdUtils.getDateTimeInUtc(scope.start.value);
          endUtc = wsdUtils.getDateTimeInUtc(scope.end.value);
        }

        wsdStateService.setState("startUtc", startUtc);
        wsdStateService.setState("endUtc", endUtc);

        var reservedReservableIds = searchOption.reservedReservables
          ? searchOption.reservedReservables.join(",")
          : scope.reservedReservables.join(",");

        // prepare for pagination
        var pageSize = !isNaN(searchOption.pageSize)
          ? searchOption.pageSize
          : scope.pageSize;
        var viewType = searchOption.viewType
          ? searchOption.viewType
          : wsdStateService.getState("resultViewType");
        var nextItemIndex = searchOption.isPaginationSearch
          ? _nextItemIndex
          : null;
        var reservableFilter = wsdStateService.getState("reservableFilter");

        var sortBy = wsdStateService.getState("searchSortBy");
        if (!sortBy) sortBy = "a_z";

        // constructing search request object
        var searchRequestObj = {
          mode: scope.mode,
          reservable_module: _.has(scope.reservable_module, "value")
            ? scope.reservable_module.value
            : "",
          building: _.has(scope.building, "value") ? scope.building.value : "",
          start: startUtc,
          end: endUtc,
          next_item_index: nextItemIndex,
          page_size: pageSize,
          include_unavailable_items: false,
          include_reservations_within_days: false,
          include_standard_services: true,
          include_reservable_purposes: true,
          sort_by: sortBy,
          shift: shift,
        };

        // add filter data to the search request object
        searchRequestObj = _addFilterDataToRequestObj(
          reservableFilter,
          searchRequestObj
        );

        if (scope.mode === "edit") {
          var ids = scope.reservation.sys_id;
          if (_isMultiReservation(scope.reservation)) {
            ids = scope.reservation.locations
              .map(function (loc) {
                return String(loc.reservation.sys_id);
              })
              .join(",");
          }

          // set reservation id(s), a single sys_id string for a single reservation, and comma separated string for multi-child reservation
          searchRequestObj.reservation_ids = ids;
          searchRequestObj.reserved_reservables = reservedReservableIds;
        }

        if (viewType === "schedule") {
          searchRequestObj.include_unavailable_items = true;
          searchRequestObj.include_reservations_within_days = true;
        } else if (viewType === "map") {
          searchRequestObj.include_unavailable_items = true;
        }

        return searchRequestObj;
      }

      /**
       * Gets the start of shift, if today will return one hour from now, else will return start of day.
       * @param {string} shiftStartDate
       * @return {string}
       */
      function _getShiftStartInUtc(shiftStartDate) {
        if (wsdUtils.isDateTimeToday(shiftStartDate))
          return wsdUtils.getDateTimeInUtc(suggestedStart);

        return wsdUtils.getDateTimeInUtc(scope.shiftStart.value, dateFormat);
      }

      /**
       * Add additional filter data to the search request object (floors, services, purposes, capacity)
       * @param {ReservableFilterForSearch} reservableFilter
       * @param {SearchRequest} searchRequestObj
       * @return {SearchRequest}
       * @private
       */
      function _addFilterDataToRequestObj(reservableFilter, searchRequestObj) {
        if (!reservableFilter) return searchRequestObj;

        var filters = [
          "floors",
          "standard_services",
          "reservable_purposes",
          "capacity",
        ];
        for (var i = 0; i < filters.length; i++) {
          var filter = filters[i];
          searchRequestObj[filter] = _.has(reservableFilter, filter)
            ? reservableFilter[filter]
            : "";
        }

        return searchRequestObj;
      }

      /**
       * Validate whether all required fields are set to a correct value
       * @return {{isValid: boolean, fields: string[]}}
       */
      function evaluateSearchPossibility() {
        var isValid = true;
        var fields = [];

        _evaluateRecurringPossibility();

        if (!scope.reservable_module || !scope.reservable_module.value) {
          isValid = false;
          fields.push("${Type}");
        }

        if (!scope.building || !scope.building.value) {
          isValid = false;
          fields.push("${Building}");
        }

        if (
          !scope.start ||
          !scope.start.value ||
          !moment(scope.start.value, dateTimeFormat, true).isValid()
        ) {
          isValid = false;
          fields.push("${Start}");
        }

        // If reservation is "recurring until" the validity of end doesn't matter as we use recurringEnd
        var requiresValidEnd =
          scope.recurringDurationType !== DURATION_TYPES.until ||
          !scope.isRecurring.value;
        if (
          requiresValidEnd &&
          (!scope.end ||
            !scope.end.value ||
            !moment(scope.end.value, dateTimeFormat, true).isValid())
        ) {
          isValid = false;
          fields.push("${End}");
        }

        if (scope.isRecurring && scope.isRecurring.value) {
          // when recurring option is toggled
          if (!scope.recurringRepeats) {
            isValid = false;
            fields.push("${Repeats}");
          }

          if (!scope.recurringDurationType) {
            isValid = false;
            fields.push("${Lasts}");
          }

          if (
            scope.recurringDurationType === DURATION_TYPES.count &&
            (!scope.occurrenceCount || scope.occurrenceCount < 2)
          ) {
            isValid = false;
            fields.push("${Number of occurrences}");
          }

          if (
            scope.recurringDurationType === DURATION_TYPES.until &&
            (!scope.recurringEnd ||
              !scope.recurringEnd.value ||
              !moment(scope.recurringEnd.value, dateTimeFormat, true).isValid())
          ) {
            isValid = false;
            fields.push("${Date and time}");
          }

          if (scope.recurringRepeats === "weekly" && !scope.recurringDays) {
            isValid = false;
            fields.push("${Days}");
          }
        }

        if (scope.shiftMode) {
          if (!scope.selectedShift || !scope.selectedShift.value) {
            isValid = false;
            fields.push("${Shift schedule}");
          }
          if (!scope.shiftStart || !scope.shiftStart.value) {
            isValid = false;
            fields.push("${Start date}");
          }
        }

        return {
          isValid: isValid,
          fields: fields,
        };
      }

      /**
       * set state for searching indicator
       * @param {boolean} isPaginationSearch - whether the search action is a new search (page number is 0), or a pagination search
       * @param {boolean} isSearching - state if it is busy searching
       * @private
       */
      function _setSearchIndicatorState(isPaginationSearch, isSearching) {
        var indicatorKey = isPaginationSearch ? "paging" : "searching";
        scope.isLoading = isSearching;
        wsdStateService.setState(indicatorKey, isSearching);
      }

      /**
       * check if there is valid selected shift
       * @return {boolean}
       */
      function hasSelectedShift() {
        return (
          scope.shiftMode &&
          !_.isEmpty(scope.selectedShift) &&
          !!scope.selectedShift.value
        );
      }

      /**
       * Handles isRecurring change.
       * @param {boolean} isRecurring
       */
      function onIsRecurringChanged(isRecurring) {
        if (isRecurring) timeChange("recurringEnd");
      }

      /**
       * toggle All Day option, when `on`: set the start and end to the configured start and end of the day. If not known, use the default value of 8 and 17
       * @param {Event} event - browser onclick event
       */
      function toggleAllDay(event) {
        scope.isAllDay = event.currentTarget.checked;

        if (scope.isAllDay) {
          var startMmt = _getStartOrEndOfDayMmt(
            moment(scope.start.value, dateTimeFormat),
            "dayStart"
          );
          var endMmt = _getStartOrEndOfDayMmt(startMmt, "dayEnd");

          scope.start = {
            value: moment(startMmt).format(dateTimeFormat),
          };
          scope.end = {
            value: moment(endMmt).format(dateTimeFormat),
          };
        }
      }

      /**
       * check if end date input selection is disabled
       * @return {boolean}
       */
      function isEndDateDisabled() {
        return (
          (scope.isRecurring &&
            scope.isRecurring.value &&
            scope.recurringDurationType === DURATION_TYPES.until) ||
          scope.isAllDay
        );
      }

      /**
       * on shift change, set shiftId to state
       */
      function shiftChange(shift, ignoreUpdateShiftDetails) {
        var shiftId = shift.value;

        wsdStateService.setState("shiftId", shiftId);

        // load shift details
        if (!ignoreUpdateShiftDetails && scope.selectedShift) {
          scope.selectedShift.shiftDetails = null;
          if (shiftId) {
            wsdShiftService
              .getShiftDetails(shiftId)
              .then(function (shiftDetail) {
                scope.selectedShift.shiftDetails = shiftDetail;
              });
          }
        }
      }

      /**
       * get the default start of day (formatted)
       * @param {Moment} timeMmt
       * @param {'dayStart'|'dayEnd'} type start or end
       * @return {Moment}
       */
      function _getStartOrEndOfDayMmt(timeMmt, timeType) {
        return timeType === "dayStart"
          ? wsdUtils.setTimeToMomentObj(
              timeMmt.clone(),
              scope.dayStart,
              DEFAULT_DAY_START
            )
          : wsdUtils.setTimeToMomentObj(
              timeMmt.clone(),
              scope.dayEnd,
              DEFAULT_DAY_END
            );
      }

      /**
       * Validate the recurring end time of the recurring series
       * @param {Moment} start - start time of the reservation
       * @param {Moment} recurringEnd - recurring end time of the reservation
       * @private
       */
      function _recurringEndTimeValidation(start, recurringEnd) {
        // validate provided recurringEnd
        if (
          !recurringEnd ||
          !recurringEnd.format() ||
          recurringEnd.format() === "Invalid date"
        ) {
          scope.recurringEnd.value = _getSuggestedRecurringEnd(start);
          return;
        }

        // validate if recurringEnd is valid
        if (recurringEnd.isSame(start, "day") || recurringEnd.isBefore(start)) {
          scope.recurringEnd.value = _getSuggestedRecurringEnd(start);
          return;
        }

        // clean up second value
        if (recurringEnd.second() !== 0)
          scope.recurringEnd.value = recurringEnd
            .second(0)
            .format(dateTimeFormat);

        return;
      }

      /**
       * Gets the suggested datetime for the provided start
       * @param {Moment} start
       * @return {string}
       */
      function _getSuggestedRecurringEnd(start) {
        return moment(start).add(1, "month").format(dateTimeFormat);
      }

      /**
       * Handles the change of shift start
       */
      function onShiftStartChange() {
        validateShiftStart();
        recurringShiftTimeValidation();
      }

      /**
       * Validate the shift start value
       */
      function validateShiftStart() {
        if (scope.shiftStart && scope.shiftStart.value) {
          var shiftStartMmt = moment(scope.shiftStart.value, dateFormat);
          if (wsdUtils.isDateInThePast(shiftStartMmt))
            scope.shiftStart = {
              value: wsdUtils.getDateFromFormattedDateTime(suggestedStart),
            };
        }
      }

      /**
       * Validates start date of a shift search to recurring and, will move end to later date if it is before the start
       */
      function recurringShiftTimeValidation() {
        if (
          scope.shiftStart &&
          scope.shiftStart.value &&
          scope.shiftRecurringEnd &&
          scope.shiftRecurringEnd.value
        ) {
          var start = moment(scope.shiftStart.value, dateFormat);
          var recurringEnd = moment(scope.shiftRecurringEnd.value, dateFormat);
          if (start.isAfter(recurringEnd)) {
            var newEnd = start.clone();
            newEnd.add(1, "month");
            scope.shiftRecurringEnd.value = wsdUtils
              .roundUpDateTime(newEnd)
              .format(dateFormat);
          }
        }
      }

      /**
       * Calculate the amount of occurrences based on the selected recurring pattern
       * @param {Moment} start - start time of the reservation
       * @param {Moment} recurringEnd - recurring end time of the reservation
       * @param {string} recurringDays - contains the numeric value of a day when the reservation can occur, for example '45'
       */
      function _calculateAmountOfOccurrences(
        start,
        recurringEnd,
        recurringDays
      ) {
        if (
          !recurringEnd ||
          scope.recurringDurationType === DURATION_TYPES.count
        )
          return;

        var amountOfOccurrences = 0;
        var recurringDaysStr =
          recurringDays !== undefined ? recurringDays : scope.recurringDays;

        if (scope.recurringRepeats !== "weekly") {
          var repeatType = scope.recurringRepeats === "daily" ? "day" : "month";
          while (start.isBefore(recurringEnd)) {
            amountOfOccurrences++;
            start.add(1, repeatType);
          }
        } else {
          if (!recurringDaysStr) {
            scope.amountOfOccurrences = 0;
            return;
          }

          while (start.isBefore(recurringEnd)) {
            if (recurringDaysStr.indexOf(start.weekday()) > -1)
              amountOfOccurrences++;

            start.add(1, "day");
          }
        }

        scope.amountOfOccurrences = amountOfOccurrences;
      }

      /**
       * Get the suggested end time (string) based on start time, default = start + 1 hour, if isAllDay is on, then the scope.dayEnd value will be used
       * @param {Moment} start
       * @return {string} suggested end date
       */
      function _getSuggestedEnd(start) {
        return _getSuggestedEndMmt(start).format(dateTimeFormat);
      }

      /**
       * Fetch a list of fields that are invalid
       * When a field is invalid, it will push the corresponding label, which will be displayed to the user
       * @param {SearchRequest} searchRequest - search request object to send to search API endpoint
       * @return {string[]} - list of invalid field labels
       */
      function _fetchInvalidFields(searchRequest) {
        var requiredFields = [
          {
            label: "${Type}",
            value: "reservable_module",
          },
          {
            label: "${Building}",
            value: "building",
          },
          {
            label: "${Start date and time}",
            value: "start",
          },
          {
            label: "${End date and time}",
            value: "end",
          },
        ];
        var invalidFields = [];

        requiredFields.forEach(function (field) {
          if (!searchRequest[field.value]) invalidFields.push(field.label);
        });

        return invalidFields;
      }

      /**
       * Display a notification to the user
       * @param {string} [msg] - message that should be displayed to the end user
       * @param {string} [type] - type of notification that should be displayed (success, info, warning, danger)
       * @param {string} [icon] - icon that should be displayed (e.g., fa-info-circle)
       * @return {void}
       */

      function _showNotification(msg, type, icon) {
        scope.searchNotificationConfig = {
          msg: msg,
          type: type,
          icon: icon,
        };
        scope.showSearchNotification = true;
      }

      /**
       * Create an object that can be used as a recurring pattern based on the users selected filters
       * @return {{duration: number, repeats: string, options: {count: number, daysOfWeek: string, every: number}, startDate: string} | null}
       * @private
       */
      function _createRecurringPattern() {
        if (!scope.isRecurring.value) return null;

        var start = scope.shiftMode
          ? moment(scope.shiftStart.value, dateFormat)
          : moment(scope.start.value, dateTimeFormat);

        var end = moment(scope.end.value, dateTimeFormat);
        var isoStart = start.utc().format();
        var duration = moment.duration(end.diff(start)).asMilliseconds();

        var recurringPattern = {
          repeats: scope.recurringRepeats,
          startDate: isoStart,
          duration: duration,
        };

        var options = {
          every: scope.recurringEvery,
          daysOfWeek: scope.recurringDays,
        };

        if (scope.shiftMode) {
          recurringPattern.amountOfDates = null;
          options.endDate = moment(scope.shiftRecurringEnd.value, dateFormat)
            .utc()
            .format();
          options.shift = true;
        } else {
          if (scope.recurringDurationType === DURATION_TYPES.count)
            options.count = scope.occurrenceCount;
          else {
            options.endDate = moment(scope.recurringEnd.value, dateTimeFormat)
              .utc()
              .format();
            recurringPattern.amountOfDates = scope.amountOfOccurrences;
          }
        }

        recurringPattern.options = options;
        return recurringPattern;
      }

      /**
       *
       * @param {boolean} asString
       * @return {string|{search: *[], pattern: ({duration: number, repeats: string, options: {count: number, daysOfWeek: string, every: number}, startDate: string}|null)}}
       * @private
       */
      function _getCurrentSearchValues(asString) {
        var searchRequestObj = FILTER_FIELDS.map(function (scopeProperty) {
          return _.get(scope, scopeProperty);
        });
        var values = {
          search: searchRequestObj,
          pattern: _createRecurringPattern(),
        };

        if (asString) return JSON.stringify(values);

        return values;
      }

      /**
       * Tells the state whether search params where changed after fetching reservables or not
       * @private
       */
      function _handleSearchChange(newData, oldData) {
        var currentSearch = wsdStateService.getState("committedSearch");
        var reservableModule = newData[0]; // 0 is reservableModule
        var building = newData[1]; // 1 is building due to the order of FILTER_FIELDS
        var recurringShiftEndDate = newData[13];
        var shiftEndChanged = recurringShiftEndDate !== oldData[13];
        var recurringChanged = newData[6] === oldData[6];

        if (
          building !== previousBuilding ||
          (reservableModule && reservableModule !== previousModule)
        )
          _checkShiftMode(reservableModule, building);

        // To prevent duplicate triggers as oldData from watcher is not always accurate before angular 1.7
        // https://github.com/angular/angular.js/issues/16392#issuecomment-355843405
        previousBuilding =
          previousBuilding === building ? previousBuilding : building;
        previousModule =
          previousModule === reservableModule
            ? previousModule
            : reservableModule;

        var validSearchResult = evaluateSearchPossibility();
        scope.canSearch = validSearchResult.isValid;
        if (shiftEndChanged || recurringChanged)
          wsdStateService.setState("resultsDeviate", true);

        // no search has been executed yet
        if (!currentSearch) return;

        wsdStateService.setState("isRecurring", scope.isRecurring.value);

        var shiftRecurEnd =
          scope.shiftMode && scope.isRecurring.value
            ? scope.shiftRecurringEnd.value
            : null;
        wsdStateService.setState("shiftRecurringEnd", shiftRecurEnd);

        var showDeviateResult =
          validSearchResult.isValid &&
          currentSearch !== _getCurrentSearchValues(true);
        wsdStateService.setState("resultsDeviate", showDeviateResult);
      }

      /**
       * validates whether search needs to go into shiftMode or not and will set appropriate data
       * @param {string} moduleId
       * @param {string} buildingId
       * @private
       */
      function _checkShiftMode(moduleId, buildingId) {
        if (!moduleId || !buildingId) return;

        var url = "/api/sn_wsd_rsv/search/shift/" + buildingId + "/" + moduleId;
        $http.get(url).then(function (response) {
          if (response.status !== 200)
            _showNotification(
              "${Something went wrong while trying to load shift information}",
              "alert-warning",
              "fa-exclamation-triangle"
            );

          var shiftQueryInfo = response.data.result;
          scope.shiftMode = shiftQueryInfo.moduleHasShift;
          scope.shiftQuery = shiftQueryInfo.query;

          var validSearchResult = evaluateSearchPossibility();
          scope.canSearch = validSearchResult.isValid;

          if (!scope.shiftMode) scope.selectedShift = null;
          else {
            // only called after 'start' is init'd so it should be there at this point.
            scope.shiftStart = {
              value: wsdUtils.getDateFromFormattedDateTime(scope.start.value),
            };
          }
        });
      }

      /**
       * Clear out all the reservable filter data, usually happens when a new search is executed through the search input
       */
      function _resetReservableFilterData() {
        wsdStateService.setState("activeReservableFilter", null);
        wsdStateService.setState("reservableFilter", null);
        wsdStateService.setState("triggerFilterCount", {
          amount: 0,
        });
      }

      scope.$on("$destroy", function () {
        for (var i = 0; i < watchers.length; ++i) {
          if (typeof watchers[i] === "function") watchers[i]();
        }
        watchers = [];
      });

      /**
       * Returns whether the reservation is a multi reservation
       * @param {Reservation} reservation
       * @returns {boolean}
       */
      function _isMultiReservation(reservation) {
        return reservation.reservation_subtype.value === "multi_parent";
      }
    },
    templateUrl: "wsdSearchFilterTemplate",
  };
}

/**
 * @typedef SelectOption
 * @property {string} value - sys_id of the record
 * @property {string} displayValue - display_value of the record
 */

/**
 * @typedef SearchOption
 * @property {boolean} isPaginationSearch - to use the nextItenIndex from last search or to start new search
 * @property {number} pageSize - page size for pagination
 * @property {string} viewType - card or schedule view type
 * @property {ReservedReservable[]} reservedReservables - list of already selected reservables (edit mode)
 */

/**
 * @typedef SearchRequest search request object, used to communicate with RESTED API backend
 * @property {string} reservable_module - sys_id of reservable module
 * @property {string} building - sys_id of selected building for search criteria
 * @property {string} reservable_module - sys_id of reservable module
 * @property {string} [mode] - indicator if it's a new search or editing mode
 * @property {string} [reservation_id] - sys_id of reserved reservation
 * @property {string} start - string start time in UTC
 * @property {string} end - string end time in UTC
 * @property {number} next_item_index - index for next reservstion to load
 * @property {number} [page_size] - page size, used to detect end index
 * @property {string[]} reserved_reservables - list of sysIds of reserved item (edit mode), comma separated
 * @property {boolean} [include_unavailable_items] - whether unavailable items should be returned
 * @property {boolean} [include_reservations_within_days] - whether all reservation of each item within the day should be returned (gantt view)
 * @property {boolean} [include_standard_services] - whether include standard services for location reservable type should be returned
 */

/**
 * @typedef RecurringDurationOption
 * @property {string} id - value of the select option
 * @property {string} text - text to display in the select option
 */
