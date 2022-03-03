// wsdReservation - directive
// RC - customized - duplicate check - mreged with oob
// custom type definitions can be found at the bottom of the file.

function wsdReservation(
  $window,
  $location,
  $q,
  $uibModal,
  spModal,
  wsdReservationService,
  wsdMultiReservationService,
  wsdExtraServiceRequestService,
  wsdStateService,
  wsdUtils
) {
  return {
    restrict: "E",
    scope: {
      isNative: "<",
      translations: "<",

      mode: "<",
      start: "<",
      end: "<",
      shift: "<",
      shiftFilteringAllowed: "<",
      shiftOnBehalfOfUsers: "<",
      reservables: "<",
      reservableIds: "<",
      reservableModule: "<",
      reservation: "<",
      reservationId: "<",
      reservationType: "<",
      reservationSubType: "<",
      reservationPurpose: "<",
      recurringPattern: "<",
      requireSubject: "<",
      displayNumberOfAttendees: "<",
      displayOnBehalfOf: "<",
      displaySensitivity: "<",
      pageIds: "<",
      summaryPageId: "<",
      searchPageId: "<",
      reservationAcl: "<",
      reservedExtraServices: "<",
    },

    link: function (scope) {
      var RSV_EDIT_RESTRICTION = {
        noRestriction: "no_restriction",
        serviceOnly: "service_only",
        fullyRestricted: "fully_restricted",
      };
      var DEFAULT_NUMBER_OF_ATTENDEES = 1;
      var RSV_SUB_SOURCES = {
        servicenow_nowmobile: "servicenow_nowmobile",
        servicenow_wsd: "servicenow_workplace_service_delivery",
      };

      scope.redirectToSearchPage = redirectToSearchPage;
      scope.redirectToMyReservationsPage = redirectToMyReservationsPage;
      scope.handleCancelPress = handleCancelPress;
      scope.createReservation = createReservation;
      scope.updateReservation = updateReservation;
      scope.toggleSensitivity = toggleSensitivity;
      scope.getDateTimeInFormat = wsdUtils.getDateTimeInFormat;
      scope.getDateInFormat = wsdUtils.getDateInFormat;
      scope.getTimeFromDate = wsdUtils.getTimeFromDate;
      scope.getHumanizedTimeDuration = wsdUtils.getHumanizedTimeDuration;
      scope.validateAttendeeCount = validateAttendeeCount;
      scope.canEditOnBehalf = canEditOnBehalf;
      scope.canUserEditReservationDetails = canUserEditReservationDetails;

      scope.openExtraServicesModal = openExtraServicesModal;
      scope.closeExtraServicesModal = closeExtraServicesModal;
      scope.addExtraServiceToModal = addExtraServiceToModal;
      scope.removeExtraServiceFromModal = removeExtraServiceFromModal;
      scope.removeCategoryExtraServicesFromReservable = removeCategoryExtraServicesFromReservable;
      scope.addExtraServicesToReservable = addExtraServicesToReservable;
      scope.handleExtraServiceSelection = handleExtraServiceSelection;
      scope.calcExtraServicePrice = calcExtraServicePrice;
      scope.hasActiveExtraServices = hasActiveExtraServices;
      scope.filterAddedServices = wsdUtils.filterAddedServices;
      scope.isExtraServicesEnabled = isExtraServicesEnabled;

      // object that holds the extra services that will be added to the reservation
      scope.addedExtraServices = {};
      scope.textPrimaryBtnModal = "${Add}";

      scope.isMulti = false;
      scope.isLoading = false;
      scope.isRedirecting = false;
      scope.isProcessingExtraServices = false;
      scope.sensitivity = "normal";
      scope.onBehalfOf = {};
      scope.numberOfAttendees = {};
      scope.selectedSubCategoryEl = null;
      scope.disableButton = false;
      // disables reservation api calls, while either reservation api call is being handled and while the page is waiting for redirect
      // so the user cannot resubmit in the time when the request is finished but the redirect is still being processed
      // only if the api errors, the submit button will be unlocked
      scope.disableReservationCreation = false;

      function init() {
        scope.sensitivity = "normal";
        scope.onBehalfOf = {
          value: NOW.user_id,
          displayValue: NOW.user_display_name,
        };
        _fetchDataFromReservation();
        _createInitialReservablesWatcher();
        _setSelectedSensitivityValue(scope.sensitivity);
        if (scope.shiftFilteringAllowed)
          _prepareShiftUserPicker(scope.shiftOnBehalfOfUsers);
      }
      init();

      /**
       * construct select2 data so that it can be displayed for shift users
       * @param shiftUsers
       * @private
       */
      function _prepareShiftUserPicker(shiftUsers) {
        scope.shiftUserFormatted = _constructShiftUserSelect2OptionsData(
          shiftUsers
        );
        scope.shiftUserSelect2Options = {
          data: scope.shiftUserFormatted,
          placeholder: {
            id: scope.onBehalfOf.value,
            text: scope.onBehalfOf.displayValue,
          },
          formatResult: buildShiftUserItemLayout,
          formatSelection: buildShiftUserItemLayout,
        };
      }
      /**
       * format shift user data so that it can be displayed in select2 dropdown.
       * @param shiftUsers
       * @returns []
       * @private
       */
      function _constructShiftUserSelect2OptionsData(shiftUsers) {
        var convertedData = [];

        if (!shiftUsers || !wsdUtils.arrayHasElement(shiftUsers))
          return convertedData;

        shiftUsers.forEach(function (element) {
          var obj = {
            id: element.value,
            text: element.displayValue,
          };
          convertedData.push(obj);
        });

        return convertedData;
      }
      /**
       * Builds the html for the sort by options
       * @param {SortByOption} item Sort By option to render html for
       * @returns {string}
       */
      function buildShiftUserItemLayout(item) {
        return wsdUtils.formatString(
          '<span title="{0}" aria-label="{0}">{1}</span>',
          item.text,
          item.text
        );
      }

      /**
       * used to load data from a passed reservation, to the display fields
       * @private
       */
      function _fetchDataFromReservation() {
        if (scope.mode !== "edit" || !scope.reservation) return;

        scope.subject = scope.reservation.subject || "";
        scope.sensitivity = scope.reservation.sensitivity.value
          ? scope.reservation.sensitivity.value
          : "normal";

        if (Object.hasOwnProperty.call(scope.reservation, "location")) {
          // when the reservation object has the 'location' property, it indicates a single room - object
          scope.numberOfAttendees[scope.reservation.location.sys_id] = scope
            .reservation.number_of_attendees
            ? scope.reservation.number_of_attendees
            : DEFAULT_NUMBER_OF_ATTENDEES;
        } else {
          // when the reservation object has the 'locations' property, it indicates a list of rooms - array
          scope.reservation.locations.forEach(function (loc) {
            scope.numberOfAttendees[loc.sys_id] = loc.number_of_attendees
              ? loc.number_of_attendees
              : DEFAULT_NUMBER_OF_ATTENDEES;
          });
        }

        if (!scope.start || !scope.end) {
          scope.start = scope.reservation.start;
          scope.end = scope.reservation.end;
        }

        if (scope.reservation.shift) scope.shift = scope.reservation.shift;

        if (scope.reservation.requested_for)
          scope.onBehalfOf = _prepairOnBehalfOf(
            scope.reservation.requested_for
          );
      }

      /**
       * When the reservables contain data, check for multi mode and prepare number of attendees input
       */
      function _createInitialReservablesWatcher() {
        var reservablesListener = scope.$watch("reservables", function (
          newVal
        ) {
          if (!newVal) return;

          scope.isMulti = _isMulti(scope.reservables);
          scope.constructReservableName = constructReservableName;

          scope.reservables.forEach(function (reservable) {
            if (scope.mode !== "edit")
              scope.addedExtraServices[reservable.sys_id] = {};
            else {
              // unable to find any reserved extra services
              if (_.isEmpty(scope.reservedExtraServices)) {
                scope.addedExtraServices[reservable.sys_id] = {};
                return;
              }
              _addCategoryInformationToAddedServices(reservable);
            }
          });
          _processExtraServicesForUnknownReservables();

          if (!_.isEmpty(scope.numberOfAttendees)) {
            reservablesListener();
            return;
          }

          scope.reservables.forEach(function (reservable) {
            scope.numberOfAttendees[
              reservable.sys_id
            ] = DEFAULT_NUMBER_OF_ATTENDEES;
          });
          reservablesListener();
        });
      }

      /**
       * Ensure that all previously reserved items that do not have a matching reservable, are marked as cancelled and added to 'addedExtraServices' object
       * Only applies for edit mode
       * @private
       */
      function _processExtraServicesForUnknownReservables() {
        if (scope.mode !== "edit" || _.isEmpty(scope.reservedExtraServices))
          return;

        var reservableSysIds = Object.keys(scope.reservedExtraServices);
        for (var i = 0; i < reservableSysIds.length; i++) {
          var id = reservableSysIds[i];

          if (scope.addedExtraServices[id]) continue;

          var reservedExtraSerivce = scope.reservedExtraServices[id];
          var categoryNames = Object.keys(reservedExtraSerivce);

          if (!categoryNames.length) continue;

          for (var j = 0; j < categoryNames.length; j++) {
            var categoryName = categoryNames[j];
            reservedExtraSerivce[categoryName].addedServices.forEach(function (
              service
            ) {
              service.cancelFlag = true;
            });
          }

          scope.addedExtraServices[id] = reservedExtraSerivce;
        }
      }

      /**
       * return object that can be set in record picker
       * @param onBehalfObj
       * @returns {object}
       * @private
       */
      function _prepairOnBehalfOf(onBehalfObj) {
        var onBehalf = {};
        onBehalf = onBehalfObj;
        onBehalf.displayValue = onBehalfObj.name;
        onBehalf.value = onBehalfObj.sys_id;
        return onBehalf;
      }

      /**
       * Use jquery to set the selected value of sensitivity, as this is the only way apearntly
       * @param value - option that will be set as selected
       * @private
       */
      function _setSelectedSensitivityValue(value) {
        $("#reservation-sensitivity").val(value).trigger("change.select2");
      }

      function _showSavingErrorMessage(errorMsg, obj) {
        _showNotification(errorMsg, "alert-danger", "fa-exclamation-triangle");
        wsdStateService.setState("currentReservation", obj);
      }

      /**
       * Selects recurring or normal create flow
       * @return {void}
       */
      function createReservation() {
        // check if creating is locked, then return or lock creating
        if (scope.disableReservationCreation) return;

        scope.disableReservationCreation = true;
        scope.disableButton = true;
        var invalidFields = _fetchInvalidFields(scope.requireSubject);
        if (wsdUtils.arrayHasElement(invalidFields)) {
          _showInvalidFieldsError(invalidFields);
          scope.disableReservationCreation = false;
          scope.disableButton = false;
          return;
        }

        if (scope.mode === "recurring_create")
          _createRecurringReservation()["catch"](
            _catchFailedReservationCreate(
              "${A recurring reservation could not be created at the moment, please try again}"
            )
          );
        else if (scope.isMulti)
          _createMultiReservation()["catch"](
            _catchFailedReservationCreate(
              "${A Multi-reservation could not be created at the moment, please try again}"
            )
          );
        else
          _createSingleReservation()["catch"](
            _catchFailedReservationCreate(
              "${A reservation could not be created at the moment, please try again}"
            )
          );
      }
      /**
       *
       * @param {string} defaultErrorMsg
       * @return {function(*=): void} promise error handler, for reservation create api
       * @private
       */
      function _catchFailedReservationCreate(defaultErrorMsg) {
        return function (error) {
          scope.disableReservationCreation = false;
          scope.disableButton = false;
          scope.isLoading = false;

          var errorMsg = _.get(error, "data.error.message");
          errorMsg = !errorMsg
            ? defaultErrorMsg
            : wsdUtils.formatString("{0}. {1}", defaultErrorMsg, errorMsg);

          _showSavingErrorMessage(errorMsg, null);
        };
      }
      /**
       * RC - moved below function up since its customized
       * changed the error handling for duplicate reservation
       * Create a single room reservation
       */
      function _createSingleReservation() {
        scope.isLoading = true;
        var reservation = _constructCreateReservationRequestObj();

        return wsdReservationService
          .createReservation(reservation)
          .then(function (response) {
            scope.isLoading = false;

            if (!response.sys_id) {
              var errorMsg =
                "${A reservation could not be created at the moment, please try again}";
              _showSavingErrorMessage(errorMsg, null);
              return;
            }

            reservation.sys_id = response.sys_id;
            wsdStateService.setState("currentReservation", reservation);

            if (_reservableHasExtraServices(reservation.location))
              _createExtraServiceRequests(
                [{ id: reservation.sys_id, locationId: reservation.location }],
                reservation.sys_id
              );
            else redirectToDetailsPage(reservation.sys_id, true);
          })
          ["catch"](function (errorResponse) {
            scope.isLoading = false;
            var errorMsg = _.get(
              errorResponse,
              "data.error.detail", //RC "data.error.message",
              "${A reservation could not be created at the moment, please try again}"
            );
            //console.log("RC wsdReservation directive ; errorMsg " + errorMsg);
            _showSavingErrorMessage(errorMsg, null);
          });
      }
      /**
       * Create a multi room reservation
       */
      function _createMultiReservation() {
        scope.isLoading = true;
        var reservation = _constructCreateReservationRequestObj();

        return wsdMultiReservationService
          .createMultiReservation(reservation)
          .then(function (response) {
            if (!response.success) {
              scope.isLoading = false;
              var errorMsg =
                "${A reservation could not be created at the moment, please try again}";
              _showSavingErrorMessage(errorMsg, null);
              return;
            }

            reservation.sys_id = response.parent;
            wsdStateService.setState("currentReservation", reservation);

            var hasServices = false;
            for (var i = 0; i < response.successfulReservations.length; i++) {
              var multiChildReservation = response.successfulReservations[i];

              if (
                multiChildReservation.inserted &&
                _reservableHasExtraServices(multiChildReservation.reservable)
              ) {
                hasServices = true;
                break;
              }
            }

            if (hasServices) {
              var successfulReservations = response.successfulReservations.reduce(
                function (total, multiChildReservation) {
                  if (multiChildReservation.inserted)
                    total.push({
                      id: multiChildReservation.sys_id,
                      locationId: multiChildReservation.reservable,
                    });
                  return total;
                },
                []
              );

              _createExtraServiceRequests(
                successfulReservations,
                reservation.sys_id
              );
            } else redirectToDetailsPage(reservation.sys_id, true);
          })
          ["catch"](function (errorResponse) {
            scope.isLoading = false;
            var errorMsg = _.get(
              errorResponse,
              "data.error.message",
              "${A reservation could not be created at the moment, please try again}"
            );
            _showSavingErrorMessage(errorMsg, null);
          });
      }

      /**
       * will insert a recurring meeting
       * @private
       */
      function _createRecurringReservation() {
        scope.isLoading = true;
        var reservation = _constructCreateReservationRequestObj(true);
        var pattern = scope.recurringPattern;
        var recurringReservation = {
          reservation: reservation,
          recurringPattern: pattern,
        };

        return wsdReservationService
          .createRecurringReservation(recurringReservation)
          .then(function (response) {
            var noCreatedMeetings =
              response.successfulReservations.length === 0 &&
              response.unSuccessfulReservations.length === 0;
            if (!response.parent || noCreatedMeetings) {
              scope.isLoading = false;
              var errorMsg =
                "${A recurring reservation could not be created at the moment, please try again}";
              _showSavingErrorMessage(errorMsg, null);
              return;
            }

            var firstOccurence = _getFirstOccurence(response);
            if (!firstOccurence) {
              scope.isLoading = false;
              var errorMsg =
                "${A recurring reservation could not be created at the moment, please try again}";
              _showSavingErrorMessage(errorMsg, null);
              return;
            }

            if (_reservableHasExtraServices(reservation.location)) {
              var successfulReservations = response.successfulReservations.reduce(
                function (total, occurrence) {
                  if (occurrence.inserted) {
                    total.push({
                      id: occurrence.sys_id,
                      locationId: reservation.location,
                      deliveryTime: occurrence.start,
                    });
                  }

                  return total;
                },
                []
              );

              _createExtraServiceRequests(
                successfulReservations,
                firstOccurence.sys_id
              );
            } else redirectToDetailsPage(firstOccurence.sys_id, true);
          })
          ["catch"](function (error) {
            scope.isLoading = false;
            var defaultErrorMsg =
              "${A recurring reservation could not be created at the moment, please try again}";
            var errorMsg = _.get(error, "data.error.message");
            errorMsg = !errorMsg
              ? defaultErrorMsg
              : wsdUtils.formatString("{0}. {1}", defaultErrorMsg, errorMsg);
            _showSavingErrorMessage(errorMsg, null);
          });
      }

      /**
       * Create extra service requests for each reservation
       * @param {{id: string, locationId: string}[]}
       * @param {string} redirectReservationSysId - the sys_id of the reservation that will be redirected towards after processing extra services
       * @param {boolean} [isUpdate] - indicates an existing reservation that is being updated
       * @private
       */
      function _createExtraServiceRequests(
        reservations,
        redirectReservationSysId,
        isUpdate
      ) {
        var extraServiceRequestList = _constructExtraServiceRequestList(
          reservations
        );
        var promiseList = [];

        // send out an API call for every extra service request
        for (var i = 0; i < extraServiceRequestList.length; i++) {
          var extraServiceRequest = extraServiceRequestList[i];

          var extraServiceRequestPromise = wsdExtraServiceRequestService
            .submitExtraServiceRequest(extraServiceRequest)
            .then(function (response) {
              return response ? true : false;
            })
            ["catch"](function () {
              return false;
            });

          promiseList.push(extraServiceRequestPromise);
        }

        // when all promises are resolved, either redirect or show an error message
        return $q.all(promiseList).then(function (result) {
          var isValid = result.every(function (el) {
            return el === true;
          });

          if (isValid) {
            redirectToDetailsPage(redirectReservationSysId, !isUpdate);
            return;
          }
          scope.isLoading = false;
          var errorMsg =
            "${Unable to process one or more extra service requests}";
          _showNotification(
            errorMsg,
            "alert-danger",
            "fa-exclamation-triangle"
          );
        });
      }

      /**
       * Construct a list of extra service request bodies that can be consumed by the Extra Service Request API (POST)
       * @param {{id: string, locationId: string}[]}
       * @return {extraServiceRequest[]}
       * @private
       */
      function _constructExtraServiceRequestList(reservations) {
        if (!wsdUtils.arrayHasElement(reservations)) return [];

        var extraServiceRequestList = [];
        for (var i = 0; i < reservations.length; i++) {
          var reservation = reservations[i];
          var reservableExtraServices =
            scope.addedExtraServices[reservation.locationId];

          if (!reservableExtraServices || _.isEmpty(reservableExtraServices))
            continue;

          var extraServiceRequest = {};
          extraServiceRequest.reservationId = reservation.id;
          extraServiceRequest.reservableId = reservation.locationId;
          extraServiceRequest.serviceCategories = [];

          var categoryNames = Object.keys(reservableExtraServices);
          for (var j = 0; j < categoryNames.length; j++) {
            var categoryName = categoryNames[j];

            if (
              !reservableExtraServices[categoryName] ||
              !wsdUtils.arrayHasElement(
                reservableExtraServices[categoryName].addedServices
              )
            )
              continue;

            var serviceCategory = {};
            serviceCategory.category = categoryName;
            serviceCategory.comment =
              reservableExtraServices[categoryName].comment || "";
            serviceCategory.flexibleServices = reservableExtraServices[
              categoryName
            ].addedServices.reduce(function (services, service) {
              var newService = {
                flexibleServiceId: service.sysId,
                deliveryTime:
                  reservation.deliveryTime ||
                  moment(scope.start).utc().format(), // for now same as rsv start
                comment: service.comments || "",
                quantity: service.quantity,
              };

              if (service.requestId)
                newService.extraServiceRequestId = service.requestId;

              if (service.cancelFlag)
                newService.cancelFlag = service.cancelFlag;

              services.push(newService);
              return services;
            }, []);

            extraServiceRequest.serviceCategories.push(serviceCategory);
          }

          if (wsdUtils.arrayHasElement(extraServiceRequest.serviceCategories))
            extraServiceRequestList.push(extraServiceRequest);
        }

        return extraServiceRequestList;
      }

      /**
       * gets info of the first occurence in the series
       * @param recurringInsert
       * @return {*}
       * @private
       */
      function _getFirstOccurence(recurringInsert) {
        var allReservations = recurringInsert.successfulReservations.concat(
          recurringInsert.unSuccessfulReservations
        );
        allReservations.sort(function (a, b) {
          if (a.start < b.start) return -1;
          else if (a.start > b.start) return 1;

          return 0;
        });
        return allReservations[0];
      }

      /**
       * Redirect the user to the search page
       * @param {boolean} [locOrTimeChange] - determine if the redirect is happening due to location or time change
       * @return {void}
       */
      function redirectToSearchPage(locOrTimeChange) {
        scope.isRedirecting = true;
        var queryParams = { id: scope.searchPageId };

        if (locOrTimeChange) {
          queryParams.mode = "edit";
          queryParams.reservation_id = scope.reservationId;
        }

        if (_reservationHasExtraServices()) {
          _showExtraServicesConfirmation(queryParams);
          return;
        }

        wsdUtils.openPage(scope.searchPageId, queryParams);
      }

      /**
       * redirects users to details page after successful creation
       * @param {string} reservationId
       * @param {boolean} isNew
       */
      function redirectToDetailsPage(reservationId, isNew) {
        var queryParams = {
          reservation_id: reservationId,
          mode: null,
        };

        // Replace edit page url with details page url in history so user cannot end up on reservation submit page which contains an outdated state
        $location.replace();

        if (isNew) queryParams.new_reservation = true;
        wsdUtils.openPage(scope.pageIds.reservationSummary, queryParams);
        // RC - disabled
        // wsdUtils.openPage(scope.summaryPageId, queryParams);
      }
      /**
       * Redirect user to My Reservations page
       */
      function redirectToMyReservationsPage() {
        wsdUtils.openPage(scope.pageIds.myReservations);
      }

      /**
       * Show a confirmation message before redirecting the user to the Search Page when there are extra services on the reservation
       * @param {{mode: string, reservation_id: string}} queryParams
       * @private
       */
      function _showExtraServicesConfirmation(queryParams) {
        spModal
          .open({
            title: "${Any changes will affect the selected extra services.}",
            message:
              "${Changing the time or location deselects all the requested services, do you want to proceed?}",
            buttons: [
              { label: "${Cancel}", cancel: true },
              { label: "${Continue}", primary: true },
            ],
          })
          .then(
            function () {
              // Continue
              wsdUtils.openPage(scope.pageIds.search, queryParams);
              //   RC - disabled
              //   wsdUtils.openPage(scope.searchPageId, queryParams);
            },
            function () {
              // Cancel
              scope.isRedirecting = false;
              //   return;
            }
          );
      }

      /**
       * When pressing cancel, redirect user to the Reservation Summary/Details page
       */
      function handleCancelPress() {
        redirectToDetailsPage(scope.reservationId);
      }

      /**
       * Show error message containing all invalid fields
       * @param {string[]} invalidFields - list of fields that are either missing or invalid
       */
      function _showInvalidFieldsError(invalidFields) {
        var errorMsg = wsdUtils.formatString(
          "{0}: {1}",
          "${Complete all required fields}",
          invalidFields.join(", ")
        );
        _showNotification(errorMsg, "alert-danger", "fa-exclamation-triangle");
      }

      /**
       * Update the currently loaded reservation and redirect
       */
      function updateReservation() {
        if (!scope.reservationId) return;

        var invalidFields = _fetchInvalidFields(scope.requireSubject);
        if (wsdUtils.arrayHasElement(invalidFields)) {
          _showInvalidFieldsError(invalidFields);
          return;
        }
        scope.isLoading = true;
        var reservation = _constructUpdateRequestObj();

        var updatePromise =
          !scope.isMulti && scope.reservation.location
            ? wsdReservationService.updateReservation(
                scope.reservationId,
                reservation
              )
            : wsdMultiReservationService.updateMultiReservation(
                scope.reservationId,
                reservation
              );

        updatePromise
          .then(function (response) {
            var reservationSysId = !scope.isMulti
              ? response.sys_id
              : response.parent;
            var extraServiceRequestProcessingResult = _initialExtraServiceRequestProcessing(
              response
            );
            if (
              wsdUtils.arrayHasElement(
                extraServiceRequestProcessingResult.reservations
              )
            )
              _createExtraServiceRequests(
                extraServiceRequestProcessingResult.reservations,
                extraServiceRequestProcessingResult.redirectReservationSysId,
                true
              );
            else redirectToDetailsPage(reservationSysId);
          })
          ["catch"](function (error) {
            scope.isLoading = false;
            var errorMsg = _.get(
              error,
              "data.error.message",
              "${A reservation could not be created at the moment, please try again}"
            );
            _showNotification(
              errorMsg,
              "alert-danger",
              "fa-exclamation-triangle"
            );
            _showSavingErrorMessage(errorMsg, reservation);
          });
        //     var extraServiceRequestProcessingResult = _initialExtraServiceRequestProcessing(
        //       response
        //     );
        //     if (
        //       wsdUtils.arrayHasElement(
        //         extraServiceRequestProcessingResult.reservations
        //       )
        //     )
        //       _createExtraServiceRequests(
        //         extraServiceRequestProcessingResult.reservations,
        //         extraServiceRequestProcessingResult.redirectReservationSysId,
        //         true
        //       );
        //     else redirectToDetailsPage(reservationSysId);
        //   })
      }
      /**
       * change sensitivity based on check box
       * @param {*} event
       */
      function toggleSensitivity(event) {
        scope.sensitivity = event.target.checked ? "private" : "normal";
      }
      /**
       * Initial processing before updating an extra service request
       * @param {*} response
       * @return {{redirectReservationSysId: string, reservations: {id: string, locationId: string}[]}}
       * @private
       */
      function _initialExtraServiceRequestProcessing(response) {
        var redirectReservationSysId;
        var reservations = [];

        if (
          response.success &&
          wsdUtils.arrayHasElement(response.successfulReservations)
        ) {
          // multi
          redirectReservationSysId = response.parent || response.sys_id;

          for (var i = 0; i < response.successfulReservations.length; i++) {
            var successfulReservation = response.successfulReservations[i];

            if (
              !successfulReservation.success ||
              !_reservableHasExtraServices(successfulReservation.reservable)
            )
              continue;

            reservations.push({
              id: successfulReservation.sys_id,
              locationId: successfulReservation.reservable,
            });
          }
        } else {
          // single|recurring
          redirectReservationSysId = response.sys_id;

          if (_reservableHasExtraServices(response.location_id))
            reservations.push({
              id: response.sys_id,
              locationId: response.location_id,
            });

          var reservableSysIds = Object.keys(scope.addedExtraServices);
          var unknownReservables = reservableSysIds.filter(function (item) {
            return item !== response.location_id;
          });

          if (unknownReservables.length > 0) {
            // any unknown reserverables come from changing the selected location of the reservation
            // So in order to prevent cancelling of the blockers for the new services we insert for the new location
            // we should first cancel the services for the previous reservable (Array.unshift)
            reservations.unshift({
              id: response.sys_id,
              locationId: unknownReservables[0],
            });
          }
          // reservations.push({
          //   id: response.sys_id,
          //   locationId: unknownReservables[0],
          // });
        }

        return {
          redirectReservationSysId: redirectReservationSysId,
          reservations: reservations,
        };
      }

      /**
       * Construct a object that will be used to update the reservation.
       * @returns {Reservation} - fields that will be updated on reservation level
       * @private
       */
      function _constructUpdateRequestObj() {
        var updateObj = {};
        var selectedStart = moment(scope.start).utc().format();
        var selectedEnd = moment(scope.end).utc().format();
        var reservedStart = moment(scope.reservation.start).utc().format();
        var reservedEnd = moment(scope.reservation.end).utc().format();

        // add start and end time values
        if (selectedStart !== reservedStart || selectedEnd !== reservedEnd) {
          updateObj.start = selectedStart;
          updateObj.end = selectedEnd;
        } else {
          updateObj.start = reservedStart;
          updateObj.end = reservedEnd;
        }

        if (scope.shift) {
          updateObj.shift = scope.shift.sys_id;
        }

        // add subject and sensitivity values
        if (
          (scope.reservation.subject !== scope.subject ||
            scope.sensitivity !== scope.reservation.sensitivity.value) &&
          scope.subject &&
          scope.subject.length > 0
        ) {
          updateObj.subject = scope.subject;
          updateObj.sensitivity = scope.sensitivity;
        }

        // add requested for value
        if (
          scope.reservation.requested_for &&
          scope.reservation.requested_for.value !== scope.onBehalfOf.value
        )
          updateObj.requested_for = scope.onBehalfOf.value;
        else if (scope.reservation.requested_for)
          updateObj.requested_for = scope.reservation.requested_for.value;

        // add last_updated_sub_source value
        var subSource = !scope.isNative
          ? RSV_SUB_SOURCES.servicenow_wsd
          : RSV_SUB_SOURCES.servicenow_nowmobile;
        if (
          scope.reservation.last_updated_sub_source &&
          scope.reservation.last_updated_sub_source.value !== subSource
        )
          updateObj.last_updated_sub_source = subSource;

        // handle multi
        if (!scope.isMulti && scope.reservation.location) {
          var reservable = scope.reservables[0];

          updateObj.location =
            reservable.sys_id !== scope.reservation.location.sys_id
              ? reservable.sys_id
              : scope.reservation.location.sys_id;

          if (
            scope.reservation.reservable_module.reservable_type !== "location"
          ) {
            updateObj.configuration_item =
              reservable.sys_id !== scope.reservation.configuration_item.sys_id
                ? scope.reservation.configuration_item.sys_id
                : reservable.sys_id;
          }

          if (
            !scope.reservation.number_of_attendees ||
            (scope.displayNumberOfAttendees &&
              scope.numberOfAttendees[reservable.sys_id] !==
                scope.reservation.number_of_attendees)
          )
            updateObj.number_of_attendees =
              scope.displayNumberOfAttendees &&
              scope.numberOfAttendees[reservable.sys_id]
                ? scope.numberOfAttendees[reservable.sys_id]
                : DEFAULT_NUMBER_OF_ATTENDEES;
        } else {
          updateObj.reservables = _constructReservableArr(true);
        }

        return updateObj;
      }

      /**
       * Construct a reservation object that will be send to the server
       * @param {boolean} [isRecurring]
       * @return {Reservation} reservation
       * @private
       */
      function _constructCreateReservationRequestObj(isRecurring) {
        var createObj = {
          reservable_module: scope.reservableModule,
          subject:
            scope.subject ||
            wsdUtils.formatString(
              "{0} {1}",
              "${Reservation for}",
              constructReservableName()
            ),
          sensitivity: scope.sensitivity,
          requested_for: scope.onBehalfOf.value,
          reservation_purpose: scope.reservationPurpose,
          sub_source: !scope.isNative
            ? RSV_SUB_SOURCES.servicenow_wsd
            : RSV_SUB_SOURCES.servicenow_nowmobile,
        };

        if (!scope.isMulti) {
          createObj.location = scope.reservableIds;
          createObj.number_of_attendees =
            scope.displayNumberOfAttendees &&
            scope.numberOfAttendees[scope.reservables[0].sys_id]
              ? scope.numberOfAttendees[scope.reservables[0].sys_id]
              : DEFAULT_NUMBER_OF_ATTENDEES;
        } else createObj.reservables = _constructReservableArr();

        if (!isRecurring) {
          createObj.start = moment(scope.start).utc().format();
          createObj.end = moment(scope.end).utc().format();
          createObj.reservation_type = scope.reservationType;
          createObj.reservation_sub_type = scope.reservationSubType;
        }

        if (scope.shift) {
          createObj.shift = scope.shift.sys_id;
        }

        return createObj;
      }

      /**
       * Display a notification to the user containing information related to the state of the reservation
       * @param {string} [msg] - message that should be displayed to the end user
       * @param {string} [type] - type of notification that should be displayed (success, info, warning, danger)
       * @param {string} [icon] - icon that should be displayed (e.g., fa-info-circle)
       * @return {void}
       */
      function _showNotification(msg, type, icon) {
        wsdStateService.setState("triggerNotification", {
          msg: msg,
          type: type,
          icon: icon,
        });
      }

      /**
       * Fetch all the invalid fields
       * @param {boolean} [requireSubject] - If true also validates subject field
       * @return {string[]} - list of invalid field names
       */
      function _fetchInvalidFields(requireSubject) {
        var requiredFields = [{ name: "sensitivity", label: "${Sensitivity}" }];

        if (requireSubject)
          requiredFields.push({
            name: "subject",
            label: "${Reservation subject}",
          });

        var invalidFields = [];

        requiredFields.forEach(function (field) {
          if (!scope[field.name]) invalidFields.push(field.label);
        });

        return invalidFields;
      }

      /**
       * Check if it's a multi room reservation
       * @param {Array} arr
       * @return {boolean}
       */
      function _isMulti(arr) {
        return wsdUtils.arrayHasElement(arr) && arr.length > 1;
      }

      /**
       * Construct a list of reservables, including number of attendees
       * @param {boolean} [isUpdate]
       * @return {Reservable[]}
       */
      function _constructReservableArr(isUpdate) {
        var reservables = [];

        scope.reservables.forEach(function (reservable) {
          var obj = {};
          obj.sys_id = reservable.sys_id;

          if (isUpdate && scope.reservation.locations) {
            // only add number of attendees property for values that were changed
            var attendeesOnRsvReservable = scope.reservation.locations.filter(
              function (loc) {
                return loc.sys_id === reservable.sys_id;
              }
            )[0];

            if (
              !attendeesOnRsvReservable ||
              (scope.displayNumberOfAttendees &&
                scope.numberOfAttendees[reservable.sys_id] !==
                  attendeesOnRsvReservable.number_of_attendees)
            )
              obj.number_of_attendees =
                scope.displayNumberOfAttendees &&
                scope.numberOfAttendees[reservable.sys_id]
                  ? scope.numberOfAttendees[reservable.sys_id]
                  : DEFAULT_NUMBER_OF_ATTENDEES;
          } else obj.number_of_attendees = scope.displayNumberOfAttendees && scope.numberOfAttendees[reservable.sys_id] ? scope.numberOfAttendees[reservable.sys_id] : DEFAULT_NUMBER_OF_ATTENDEES;

          reservables.push(obj);
        });

        return reservables;
      }

      /**
       * Validates attendee count on change
       * @param {string} reservableSysId - sys_id of the reservable
       */
      function validateAttendeeCount(reservableSysId) {
        if (
          typeof scope.numberOfAttendees[reservableSysId] !== "number" ||
          scope.numberOfAttendees[reservableSysId] < DEFAULT_NUMBER_OF_ATTENDEES
        )
          scope.numberOfAttendees[
            reservableSysId
          ] = DEFAULT_NUMBER_OF_ATTENDEES;
      }

      /**
       * Construct the name of one or more reservables
       * @return {string} - for example, Madrid or Madrid, Orlando, New York
       */
      function constructReservableName() {
        if (scope.isMulti) {
          return scope.reservables.reduce(function (
            accumulator,
            reservable,
            index
          ) {
            return index === 0
              ? reservable.name
              : accumulator + ", " + reservable.name;
          },
          "");
        }

        return scope.reservables[0].name;
      }

      /**
       * Checks reservation acl's to see if user can write to requested_for field
       * @returns {boolean}
       */
      function canEditOnBehalf() {
        if (scope.reservationAcl)
          return scope.reservationAcl.write.fields.requested_for;

        // Default returns true, if there are no reservationAcls then it is a new reservation.
        return true;
      }

      /**
       * Open the extra services modal
       * @param {string} reservableSysId - sys_id of a reservable
       * @param {ExtraServiceCategoryGrouped} selectedExtraService - extra services object of the service category that was selected
       * @param {boolean} [isEdit]
       */
      function openExtraServicesModal(
        reservableSysId,
        selectedExtraService,
        isEdit,
        event
      ) {
        // keep track of the selected sub category element. This value will later be used to set the focus back on the dropdown after the modal closes
        scope.selectedSubCategoryEl =
          event && event.target ? event.target : null;
        if (!reservableSysId || _.isEmpty(selectedExtraService)) return;

        // use the extra services that were previously saved on the reservable to further construct the modal
        var addedExtraServices = !_.isEmpty(
          scope.addedExtraServices[reservableSysId]
        )
          ? _.cloneDeep(
              scope.addedExtraServices[reservableSysId][
                selectedExtraService.category
              ]
            )
          : {};

        if (_.isEmpty(addedExtraServices)) {
          // construct modal object that will be used to populate the extra services modal
          scope.modalObj = _constructExtraServicesModalObj(
            reservableSysId,
            selectedExtraService
          );
        } else {
          _copyAddedExtraServicesToModal(addedExtraServices);
          _calcExtraServiceTotalPrice();
        }

        scope.textPrimaryBtnModal = isEdit ? "${Update}" : "${Add}";

        scope.modalTile = isEdit
          ? scope.modalObj.extraService.title.edit
          : scope.modalObj.extraService.title.add;

        /**
         * Find the details of a service by the flexible service ID
         * @param {string} serviceId
         * @return {{comment: string, flexibleServiceName: string, flexibleServiceId: string, totalPrice: Number, serviceTimes: {endPreparation: string, startPreparation: string, endCleanup: string, startCleanup: string}, category: string, quantity: string, requestId: string, subCategory: string, deliveryTime: string}|null}
         */
        scope.findServiceDefinition = function (serviceId) {
          if (!selectedExtraService) return null;

          for (
            var i = 0;
            i < selectedExtraService.flexible_service.length;
            i++
          ) {
            var serviceSubCategory = selectedExtraService.flexible_service[i];
            if (!serviceSubCategory.flexible_service) continue;

            for (
              var j = 0;
              j < serviceSubCategory.flexible_service.length;
              j++
            ) {
              var service = serviceSubCategory.flexible_service[j];
              if (service.sys_id === serviceId) return service;
            }
          }
          return null;
        };

        /**
         *
         * @param {string} id - sys_id of the selected service
         * @return {null|boolean}
         */
        scope.isQuantityEnabled = function (id) {
          var service = scope.findServiceDefinition(id);
          return service && service.quantity_enabled;
        };

        var modalInstance = $uibModal.open({
          templateUrl: "wsdExtraServicesModalTemplate",
          scope: scope,
        });

        modalInstance.result["finally"](function () {
          if (scope.selectedSubCategoryEl) {
            var extraServicesDropdownEl = _getExtraServicesDropdownEl(
              scope.selectedSubCategoryEl
            );
            extraServicesDropdownEl ? extraServicesDropdownEl.focus() : null;
          }
          // when the modal is closed (through any action), clear out the modal
          scope.modalObj = {};
        });

        scope.modalInstance = modalInstance;
      }

      /**
       * Close the extra services modal
       */
      function closeExtraServicesModal() {
        scope.modalInstance.close();
      }

      /**
       * Copy existing added extra services data to the modal object
       * @param {AddedExtraServices} addedExtraServices
       * @private
       */
      function _copyAddedExtraServicesToModal(addedExtraServices) {
        if (_.isEmpty(scope.modalObj)) scope.modalObj = {};

        var fields = [
          "reservableSysId",
          "extraService",
          "numberOfAttendees",
          "startSetupTime",
          "startCleanUpTime",
          "addedServices",
          "totalPrice",
          "comment",
          "select2Options",
        ];
        for (var i = 0; i < fields.length; i++)
          scope.modalObj[fields[i]] = addedExtraServices[fields[i]];

        if (!scope.modalObj.select2Options)
          scope.modalObj.select2Options = _constructExtraServicesSelect2Options(
            scope.modalObj.extraService
          );
      }

      /**
       * Construct an object containing data that will be used to populate the extra services modal
       * @param {string} reservableSysId - sys_id of a reservable
       * @param {ExtraServiceCategoryGrouped} selectedExtraService - extra services object of the service category that was selected
       * @return {AddedExtraServices}
       * @private
       */
      function _constructExtraServicesModalObj(
        reservableSysId,
        selectedExtraService
      ) {
        var extraServicesModal = {
          reservableSysId: reservableSysId,
          extraService: selectedExtraService,
          numberOfAttendees: scope.numberOfAttendees[reservableSysId] || 1,
          startSetupTime: wsdUtils.getTimeFromDate(scope.start),
          startCleanUpTime: wsdUtils.getTimeFromDate(scope.end),
          addedServices: [],
          totalPrice: 0,
          comment: null,
          select2Options: _constructExtraServicesSelect2Options(
            selectedExtraService
          ),
        };

        return extraServicesModal;
      }

      /**
       * Construct select2 options for the selected category (select2 options are based on extra services within a sub_category)
       * @param {ExtraServiceCategoryGrouped}
       * @return {{subCategoryName: { data: select2Option[], minimumResultsForSearch: number }}}
       * @private
       */
      function _constructExtraServicesSelect2Options(serviceGroupedByCategory) {
        var select2Options = {};

        serviceGroupedByCategory.flexible_service.forEach(function (
          serviceGroupedBySubCategory
        ) {
          var subCategoryName = serviceGroupedBySubCategory.sub_category;
          var extraServiceChoices = [];

          serviceGroupedBySubCategory.flexible_service.forEach(function (
            service
          ) {
            extraServiceChoices.push({
              id: service.sys_id,
              text: service.name,
            });
          });

          select2Options[subCategoryName] = {
            data: extraServiceChoices,
            minimumResultsForSearch: 0,
          };
        });

        return select2Options;
      }

      /**
       * Add added services to the modal (at this point it's not added to the reservable yet)
       * @param {ExtraServiceSubCategoryGrouped}
       */
      function addExtraServiceToModal(extraServiceSubCategory) {
        var modalObj = scope.modalObj;
        var activeCategory = modalObj.extraService.category;
        var calcTotalPrice = false;

        // this object represents a single extra service displayed in the FE
        var extraService = {
          clientId: wsdUtils.generateGUID(),
          sysId: "",
          name: "",
          category: activeCategory,
          subCategory: extraServiceSubCategory.sub_category,
          label: extraServiceSubCategory.label,
          quantity: modalObj.numberOfAttendees,
          //deliveryTime: modalObj.startSetupTime,
          deliveryTime: wsdUtils.getTimeFromDate(scope.start),
          price: 0,
          comments: "",
          setupDuration: null,
          label: extraServiceSubCategory.label,
          deliveryTimeLabel: "",
          quantityLabel: "",
          totalPriceLabel: "",
          commentLabel: "",
        };

        // when loaded in MESP, it requires select2 to have a valid initial value
        // if no value is supplied, it will throw an error cause it's trying to find the removed value, which does not exist
        if (scope.isNative) {
          var firstFlexibleService =
            extraServiceSubCategory.flexible_service[0];
          extraService.sysId =
            firstFlexibleService && firstFlexibleService.sys_id
              ? firstFlexibleService.sys_id
              : "";

          // when there is an extra service and quantity, total price of the chosen extra service needs to be calculated upfront
          if (extraService.sysId && extraService.quantity) {
            var availableExtraServices = _getAvailableExtraServices(
              extraServiceSubCategory.sub_category
            );
            var selectedExtraService = availableExtraServices.filter(function (
              item
            ) {
              return item.sys_id === extraService.sysId;
            })[0];

            if (
              selectedExtraService &&
              selectedExtraService.price_per_unit &&
              selectedExtraService.price_per_unit.value
            ) {
              extraService.price = (
                selectedExtraService.price_per_unit.value *
                extraService.quantity
              ).toFixed(2);
              calcTotalPrice = true;
            }
          }
        }

        scope.modalObj.addedServices.push(extraService);

        if (calcTotalPrice) _calcExtraServiceTotalPrice();
      }

      /**
       * Removes extra service from the modal (remove when it's not a previously reserved service)
       * @param {string} clientId
       */
      function removeExtraServiceFromModal(clientId) {
        var serviceResult = _getExtraServiceByClientId(clientId);

        if (!serviceResult.service) return;

        var service = serviceResult.service;
        var index = serviceResult.index;

        if (service.requestId) service.cancelFlag = true;
        else scope.modalObj.addedServices.splice(index, 1);

        _calcExtraServiceTotalPrice();
      }

      /**
       * Removes grouped by category extra services data from the reservable (data stored in addedExtraService object)
       * @param {string} reservableSysId
       * @param {string} categoryName
       */
      function removeCategoryExtraServicesFromReservable(
        reservableSysId,
        categoryName
      ) {
        spModal
          .open({
            title: "${Remove all extra services from category.}",
            message:
              "${Are you sure you want to remove all extra services from this category?}",
            buttons: [
              { label: "${Cancel}", cancel: true },
              { label: "${Remove}", primary: true },
            ],
          })
          .then(function () {
            // ensure that reserved extra services that are being cancelled, are still retained
            if (scope.mode === "edit") {
              var services = [];
              var extraServiceGroupedByCategory =
                scope.addedExtraServices[reservableSysId] &&
                scope.addedExtraServices[reservableSysId][categoryName]
                  ? scope.addedExtraServices[reservableSysId][categoryName]
                  : null;

              if (!extraServiceGroupedByCategory) return;

              for (
                var i = 0;
                i < extraServiceGroupedByCategory.addedServices.length;
                i++
              ) {
                var addedService =
                  extraServiceGroupedByCategory.addedServices[i];

                if (addedService.requestId) {
                  addedService.cancelFlag = true;
                  services.push(addedService);
                }
              }

              scope.addedExtraServices[reservableSysId][
                categoryName
              ].addedServices = services;
              return;
            }

            // in create mode, clear out the entire object
            if (scope.addedExtraServices[reservableSysId])
              scope.addedExtraServices[reservableSysId][categoryName] = {};
          });
      }

      /**
       * Adds data from the modal object to the 'addedExtraServices' object, which contains the actual data
       * This operation happens when the user presses the 'Add' button
       */
      function addExtraServicesToReservable() {
        if (scope.addedExtraServices[scope.modalObj.reservableSysId])
          scope.addedExtraServices[scope.modalObj.reservableSysId][
            scope.modalObj.extraService.category
          ] = _.cloneDeep(scope.modalObj);

        closeExtraServicesModal();
      }

      /**
       * Get the extra service based on client if in the FE
       * @param {string} clientId
       * @return {{index: number, service: ExtraService}}
       * @private
       */
      function _getExtraServiceByClientId(clientId) {
        var matchedIndex = -1;
        var service = scope.modalObj.addedServices.filter(function (
          service,
          index
        ) {
          if (service.clientId === clientId) {
            matchedIndex = index;
            return true;
          }

          return false;
        });

        service = service.length > 0 ? service[0] : null;

        return {
          index: matchedIndex,
          service: service,
        };
      }

      /**
       * Check if the provided extra services list contains at least one active (non-cancelled) service
       * @param {AddedExtraServices[]}
       * @return {boolean}
       */
      function hasActiveExtraServices(addedExtraServices) {
        return (
          addedExtraServices.filter(wsdUtils.filterAddedServices).length > 0
        );
      }

      /**
       * @param {string} clientId
       * @param {string} serviceSysId
       * @param {number} quantity
       * @param {number} price
       */
      function handleExtraServiceSelection(
        clientId,
        serviceSysId,
        quantity,
        price
      ) {
        var serviceResult = _getExtraServiceByClientId(clientId);
        var addedService = serviceResult.service;
        var index = serviceResult.index;

        if (addedService) {
          // find the extra service name based on sys_id
          var availableExtraServices = _getAvailableExtraServices(
            addedService.subCategory
          );
          var service = availableExtraServices.filter(function (item) {
            return item.sys_id === serviceSysId;
          })[0];

          if (service) {
            var addedService = scope.modalObj.addedServices[index];
            addedService.name = service.name;
            addedService.quantity = service.quantity_enabled
              ? addedService.quantity
              : 1;
            addedService.quantity_enabled = service.quantity_enabled;
            addedService.setupDuration = service.preparation_duration;
            addedService.deliveryTimeLabel = wsdUtils.formatString(
              scope.translations.deliveryTimeLabel,
              service.name
            );
            addedService.quantityLabel = wsdUtils.formatString(
              scope.translations.quantityLabel,
              service.name
            );
            addedService.totalPriceLabel = wsdUtils.formatString(
              scope.translations.totalPriceLabel,
              service.name
            );
            addedService.commentLabel = wsdUtils.formatString(
              scope.translations.commentLabel,
              service.name
            );
          }
          //   scope.modalObj.addedServices[index].name = service.name;
        }

        calcExtraServicePrice(
          clientId,
          serviceSysId,
          quantity,
          price,
          availableExtraServices
        );
      }

      /**
       * Calculate the price of the extra service that is selected
       * @param {string} clientId
       * @param {string} serviceSysId
       * @param {number} quantity
       * @param {number} price - total price of an extra service (quantity * price per unit)
       * @param {ExtraService[]} [availableExtraServices]
       */
      function calcExtraServicePrice(
        clientId,
        serviceSysId,
        quantity,
        price,
        availableExtraServices
      ) {
        var serviceResult = _getExtraServiceByClientId(clientId);
        var addedService = serviceResult.service;
        var index = serviceResult.index;

        var reservableSysId = scope.modalObj.reservableSysId;
        var activeCategory = scope.modalObj.extraService.category;

        var availableExtraServices = availableExtraServices
          ? availableExtraServices
          : _getAvailableExtraServices(addedService.subCategory);

        var service = availableExtraServices.filter(function (item) {
          return item.sys_id === serviceSysId;
        })[0];

        if (
          !service ||
          !service.price_per_unit ||
          !service.price_per_unit.value ||
          !quantity
        ) {
          if (price) {
            // update price of the service to 0 when there is no service selected or quantity defined
            scope.modalObj.addedServices[index].price = 0;
            _calcExtraServiceTotalPrice();
          }

          return;
        }

        // calculate the price of the selected service
        var newPrice = (service.price_per_unit.value * quantity).toFixed(2);
        scope.modalObj.addedServices[index].price = newPrice;

        // calculate the price of all services combined
        _calcExtraServiceTotalPrice();
      }

      /**
       * Calculate the total price of all the extra services added (total price extra service * amount)
       * @private
       */
      function _calcExtraServiceTotalPrice() {
        var activeAddedServices = scope.modalObj.addedServices.filter(
          wsdUtils.filterAddedServices
        );

        var totalPrice = activeAddedServices.reduce(function (
          accumulator,
          item
        ) {
          return accumulator + Number(item.price);
        },
        0);
        scope.modalObj.totalPrice = totalPrice.toFixed(2);
      }
      /**
       * Calculate the service times on a single extra service category (setup time)
       * @private
       */
      function _calcServiceTimes() {
        var activeAddedServices = scope.modalObj.addedServices.filter(
          wsdUtils.filterAddedServices
        );
        var startTime = moment(scope.start);

        if (!wsdUtils.arrayHasElement(activeAddedServices)) {
          scope.modalObj.startSetupTime = wsdUtils.getTimeFromDate(startTime);
          return;
        }

        var setupDurations = activeAddedServices.reduce(function (
          accumulator,
          current
        ) {
          if (current.setupDuration) accumulator.push(current.setupDuration);

          return accumulator;
        },
        []);

        if (!wsdUtils.arrayHasElement(setupDurations)) {
          scope.modalObj.startSetupTime = wsdUtils.getTimeFromDate(startTime);
          return;
        }

        var highestSetupDuration = setupDurations.reduce(function (a, b) {
          return Math.max(a, b);
        });

        scope.modalObj.startSetupTime = wsdUtils.getTimeFromDate(
          startTime.milliseconds(-highestSetupDuration)
        );
      }

      /**
       * Get a list of available flexible services
       * @param {string} subCategoryName
       * @return {ExtraService[]|[]}
       * @private
       */
      function _getAvailableExtraServices(subCategoryName) {
        var extraServiceGroupedByCategory = scope.modalObj.extraService;
        var extraServiceGroupedBySubCategory = extraServiceGroupedByCategory.flexible_service.filter(
          function (item) {
            return item.sub_category === subCategoryName;
          }
        )[0];

        if (
          extraServiceGroupedBySubCategory &&
          wsdUtils.arrayHasElement(
            extraServiceGroupedBySubCategory.flexible_service
          )
        )
          return extraServiceGroupedBySubCategory.flexible_service;

        return [];
      }

      /**
       * Add extra service category information to properly construct the services modal
       * @param {Reservable} reservable
       */
      function _addCategoryInformationToAddedServices(reservable) {
        scope.isProcessingExtraServices = true;

        var categoryNames = scope.reservedExtraServices[reservable.sys_id]
          ? Object.keys(scope.reservedExtraServices[reservable.sys_id])
          : [];

        if (!categoryNames.length) {
          scope.isProcessingExtraServices = false;
          scope.addedExtraServices[reservable.sys_id] = {};
          return;
        }

        categoryNames.forEach(function (categoryName) {
          var extraServiceGroupedByCategory = reservable.flexible_services.filter(
            function (groupedService) {
              return groupedService.category === categoryName;
            }
          )[0];

          // contains all relevant extra services data for a single category (e.g., catering or support)
          if (extraServiceGroupedByCategory)
            scope.reservedExtraServices[reservable.sys_id][
              categoryName
            ].extraService = extraServiceGroupedByCategory;
        });

        scope.addedExtraServices[reservable.sys_id] =
          scope.reservedExtraServices[reservable.sys_id];
        scope.isProcessingExtraServices = false;
      }

      /**
       * Check if at least one reservable has extra services attached to it
       * @param {string} reservableSysId
       * @return {boolean}
       * @private
       */
      function _reservableHasExtraServices(reservableSysId) {
        var categoryNames =
          scope.addedExtraServices && scope.addedExtraServices[reservableSysId]
            ? Object.keys(scope.addedExtraServices[reservableSysId])
            : [];

        if (!wsdUtils.arrayHasElement(categoryNames)) return false;

        return categoryNames.some(function (categoryName) {
          return (
            scope.addedExtraServices[reservableSysId][categoryName]
              .addedServices &&
            scope.addedExtraServices[reservableSysId][categoryName]
              .addedServices.length > 0
          );
        });
      }

      /**
       * Check if the reservation has any extra services
       * @return {boolean}
       */
      function _reservationHasExtraServices() {
        for (var i = 0; i < scope.reservables.length; i++) {
          var reservable = scope.reservables[i];

          if (_reservableHasExtraServices(reservable.sys_id)) return true;
        }

        return false;
      }

      /**
       * Checks if the extra service should be allowed for the reservable
       * @param {ReservableUnit}
       * @returns {boolean}
       */
      function isExtraServicesEnabled(reservable) {
        return (
          reservable.flexible_services.length !== 0 &&
          _.isEmpty(scope.recurringPattern)
        );
      }

      /**
       * Returns if the user can edit location and/or time
       * @return {boolean}
       */
      function canUserEditReservationDetails() {
        return (
          scope.mode === "edit" &&
          scope.reservation &&
          scope.reservation.edit_restriction.value ===
            RSV_EDIT_RESTRICTION.noRestriction
        );
      }
      /**
       * Get the extra services dropdown element based on the provided sub category element
       * Traverse up and attempt to find the button element
       * @param {Object} subCategoryEl
       * @return {Object|null}
       * @private
       */
      function _getExtraServicesDropdownEl(subCategoryEl) {
        if (!subCategoryEl) return null;

        var dropdownListEl = subCategoryEl.parentElement;
        if (!dropdownListEl) return null;

        var dropdownMenuEl = dropdownListEl.parentElement;
        if (!dropdownMenuEl) return null;

        var dropdownButtonEl = dropdownMenuEl.previousElementSibling;
        return dropdownButtonEl || null;
      }
    },

    templateUrl: "wsdReservationTemplate",

    /**
     * @typedef ReservableImage
     * @property {string} sys_id - sys_id of the attachment
     * @property {string} link - link to the attachment
     */

    /**
     * @typedef Reservation
     * @property {string} reservable_module
     * @property {string} location
     * @property {string} subject
     * @property {string} sensitivity
     * @property {string} reservation_type
     * @property {string} reservation_sub_type
     * @property {string} reservation_purpose
     * @property {number} attendees
     * @property {Object} opened_by
     * @property {string} requested_for
     * @property {Moment} start
     * @property {Moment} end
     */

    /**
     * @typedef Reservable
     * @property {string} sys_id
     * @property {number} number_of_attendees
     */

    /**
     * @typedef AddedExtraServices
     * @property {string} reservableSysId
     * @property {ExtraServiceCategoryGrouped} extraService
     * @property {number} numberOfAttendees
     * @property {string} startSetupTime
     * @property {string} startCleanUpTime
     * @property {number} totalPrice
     * @property {string} comment
     */

    /**
     * @typedef ExtraServiceCategoryGrouped
     * @property {string} category
     * @property {string} label
     * @property {string} title
     * @property {string} sub_title
     * @property {string} text
     * @property {ExtraServiceSubCategoryGrouped[]} flexible_service
     */

    /**
     * @typedef ExtraServiceSubCategoryGrouped
     * @property {string} sub_category
     * @property {string} label
     * @property {ExtraService[]} flexible_service
     */

    /**
     * @typedef ExtraService
     * @property {string} sys_id
     * @property {string} name
     * @property {string} short_description
     * @property {string} category
     * @property {string} category_label
     * @property {string} sub_category
     * @property {string} sub_category_label
     * @property {ReservableImage|null} image
     * @property {boolean} quantity_required
     * @property {number} preparation_duration
     * @property {number} cleanup_duration
     * @property {Price|null} price_per_unit
     * @property {string} title
     * @property {string} sub_title
     * @property {string} text
     */

    /**
     * @typedef Price
     * @property {string} value
     * @property {string} code
     */

    /**
     * @typedef select2Option
     * @property {string} id
     * @property {string} text
     */
  };
}
