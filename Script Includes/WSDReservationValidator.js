/** WSDReservationValidator
 * Implementation class for reservation validation. Can be used to overwrite the base SNC one.
 */
var WSDReservationValidator = Class.create();
WSDReservationValidator.prototype = Object.extendsObject(
  WSDReservationValidatorSNC,
  {
    /** RC - overriding - testing WIP
     * validate reservation object and resolve properties to appropriate sys_id if applicable.
     * @param {Reservation} reservationRequestInput reservation request object
     * @param {boolean} [isMulti] - to validate this reservation as a multi reservation or single reservation
     * @return {ValidationResult} result resolved result with correct sys_id for related field
     */
    validateAndResolveReservation: function (reservationRequestInput, isMulti) {
      // gs.info(
      //   "RC resevation validator ; reservationRequestInput " +
      //     JSON.stringify(reservationRequestInput)
      // );
      var result = {
        valid: false,
        msg: "Reservation data is invalid",
        user_msg: "",
        reservation: null,
        type_of_change: null,
      };
      var typeOfChange = this.detectTypeOfChange(reservationRequestInput);
      result.type_of_change = typeOfChange;

      var reservation;
      if (isMulti) reservation = reservationRequestInput;
      else reservation = WSDUtils.deepClone(reservationRequestInput);
      // got searched params in below

      reservation.type_of_change = typeOfChange;

      if (reservation.hasOwnProperty("sys_id")) {
        var reservationExistsOutcome;

        if (isMulti)
          reservationExistsOutcome = this.validateMultiReservationExists(
            reservation.sys_id
          );
        if (!isMulti || !reservationExistsOutcome.valid)
          reservationExistsOutcome = this.validateReservationExists(
            reservation.sys_id
          );

        if (!reservationExistsOutcome.valid) {
          result.msg = reservationExistsOutcome.msg;
          result.user_msg = reservationExistsOutcome.user_msg;
          return result;
        }

        result.reservationGr = reservationExistsOutcome.reservationGr;
        reservation.reservationGr = reservationExistsOutcome.reservationGr;
        if (result.reservationGr.reservable_module.nil()) {
          result.msg = "Reservation does not have a reservable module";
          result.user_msg = gs.getMessage(
            "Reservation does not have a reservable module and is not valid"
          );
          return result;
        }
        reservation.reservableModuleGr = result.reservationGr.reservable_module.getRefRecord();

        result.reservationIsMulti =
          result.reservationGr.getValue("reservation_subtype") ===
          WSDConstants.RESERVATION_SUBTYPE.multi_parent;
        if (result.reservationIsMulti)
          reservation.multiChildReservations = this.getMultiChildReservationsData(
            reservation.sys_id
          );

        // if there is a reservationGr, validate the check_in_state one time.
        if (reservation.check_in_state) {
          // can update end because both state and location/start/end arent updated ever at the same time.
          var fields = this.determineReservationFieldsFromCheckInState(
            result.reservationGr,
            reservation
          );
          if (fields) {
            if (fields.state) reservation.state = fields.state;

            if (fields.end) {
              reservation.start = result.reservationGr.getValue("start");
              reservation.end = fields.end.getValue();
              // set typeOfChange to time when end is to be updated
              typeOfChange = WSDConstants.ROOM_RESERVATION_CHANGE_TYPE.time;
              result.type_of_change = typeOfChange;
              reservation.type_of_change = typeOfChange;
            }
          }
        }
      } else if (reservation.reservable_module) {
        // validate reservable module, should not run if there is a reservationId provided, as reservableModule cannot be updated.
        var reservableModuleOutcome = this.validateReservableModule(
          reservation.reservable_module
        );
        if (!reservableModuleOutcome.valid) {
          result.user_msg = gs.getMessage(
            "Reservable module is invalid or unavailable."
          );
          return result;
        }
        reservation.reservableModuleGr =
          reservableModuleOutcome.reservableModuleGr;
      }
      // got searched params in below when logged

      // validate location
      if (reservation.location) {
        var locationResult = this.validateLocationByReservableModule(
          reservation.reservableModuleGr,
          reservation.location
        );
        if (!locationResult.valid) {
          result.user_msg = gs.getMessage("Location is invalid or unavailable");
          return result;
        }
        reservation.location = locationResult.sys_id;
        reservation.workplace_location = locationResult.sys_id; // set workplace_location for backward compatibility
        reservation.locationGr = locationResult.locationGr;
      }

      // validate reservables
      if (reservation.reservables) {
        // if trying to convert single to multi, but invalid reservables count found, prevent update
        if (
          result.reservationGr &&
          !result.reservationIsMulti &&
          reservation.reservables.length < 2
        ) {
          result.user_msg = gs.getMessage(
            "The request is invalid due to the number of selected items"
          );
          result.msg =
            "Attempting to convert a single reservation to a multi, but insufficient reservables found";
          return result;
        }
        for (var i = 0; i < reservation.reservables.length; i++) {
          var reservable = reservation.reservables[i];
          var itemResult = this.validateLocationByReservableModule(
            reservation.reservableModuleGr,
            reservable.sys_id
          );
          if (!itemResult.valid) {
            result.user_msg = gs.getMessage(
              "Reservable is invalid or unavailable"
            );
            return result;
          }
          reservable.sys_id = itemResult.sys_id;
          reservable.reservableGr = itemResult.locationGr;
        }
      }
      // gs.info(
      //   "RC WSDReservationValidator ; req for check ; before check " +
      //     reservation.requested_for
      // );
      // validate requested_for
      if (reservation.requested_for) {
        var requestedForResult = this.validateUser(reservation.requested_for);
        if (!requestedForResult.valid) {
          result.user_msg = gs.getMessage("Requested for is an invalid user");
          return result;
        }
        reservation.requested_for = requestedForResult.sys_id;
        // gs.info(
        //   "RC WSDReservationValidator ; req for check ; inside check " +
        //     reservation.requested_for
        // );
      }

      if (reservation.sensitivity) {
        var sensitivityResult = this.validateSensitivity(
          reservation.sensitivity
        );
        if (!sensitivityResult.valid) {
          result.user_msg = gs.getMessage(
            "Reservation subject sensitivity is not one of the allowed choices"
          );
          return result;
        }
      }
      // got searched params in below when logged
      //   gs.info(
      //     "RC resevation validator ; before start reservation " +
      //       JSON.stringify(reservation)
      //   );

      if (reservation.start) {
        var validateStartEndOutcome = this.validateAndResolveReservationStartEnd(
          reservation.reservableModuleGr,
          reservation.start,
          reservation.end,
          reservation.shift
        );
        if (!validateStartEndOutcome.valid) {
          result.user_msg = validateStartEndOutcome.user_msg;
          result.msg = validateStartEndOutcome.msg;
          return result;
        }

        var startEndPayload = validateStartEndOutcome.payload;
        reservation.start = startEndPayload.startGdt;
        reservation.end = startEndPayload.endGdt;
        reservation.shift = startEndPayload.shiftGr
          ? startEndPayload.shiftGr.getValue("sys_id")
          : null;
        reservation.shiftGr = startEndPayload.shiftGr;
      }
      // date are not available in reservation anymore - it works
      // for some reason stringify doesnt show ; direct dot walk works , strange !
      //   gs.info(
      //     "RC resevation validator ; after start reservation " +
      //       reservation.start +
      //       " " +
      //       reservation.end
      //   );

      if (
        reservation.shift &&
        reservation.reservationGr &&
        reservation.reservationGr.getValue("shift") !== reservation.shift
      ) {
        result.msg = "Changing the shift of a reservation is not allowed";
        return result;
      }

      // validate that module matches location/start/end
      if (reservation.location || reservation.reservables) {
        var reservables;
        var reservationSysIds;
        if (isMulti) {
          reservables = reservation.reservables;
          if (!result.reservationIsMulti) {
            reservationSysIds = reservation.sys_id;
          } else if (reservation.multiChildReservations)
            reservationSysIds = reservation.multiChildReservations.map(
              function (childReservation) {
                return childReservation.sys_id;
              }
            );
        } else {
          reservables = [
            {
              sys_id: reservation.location,
              reservableGr: reservation.locationGr,
            },
          ];
          reservationSysIds = reservation.sys_id;
        }

        var reservableOutcome = this.validateReservableAgainstModuleAndAvailability(
          typeOfChange,
          reservation.reservableModuleGr,
          reservables,
          reservation.start,
          reservation.end,
          reservationSysIds,
          reservation.shiftGr
        );
        if (!reservableOutcome.valid) {
          result.msg = reservableOutcome.msg;
          result.user_msg = reservableOutcome.user_msg;
          return result;
        }
      }

      //RC ; custom code - validate duplicate reservation
      // for single one
      var sysIdExist = false; // RC if its in update mode - dont run code
      var tmp_requested_for = reservation.requested_for
        ? reservation.requested_for
        : gs.getUserID();
      sysIdExist = reservation.hasOwnProperty("sys_id") ? true : false;
      //   gs.info(
      //     "RC WSDReservationValidator ; before duplicate check ; checking update feature" +
      //       sysIdExist
      //   );
      if (!sysIdExist) {
        if (
          this.validateDuplicateReservationSingle(
            tmp_requested_for,
            reservation.start,
            reservation.end
          )
        ) {
          result.valid = false;
          result.msg = gs.getMessage("duplicate_reserve_error_single", [
            this.getUserNameFromID(tmp_requested_for),
          ]);
          //result.user_msg = "Duplicate reservation found ! Cannot proceed ... ";
          result.reservation = null;
          result.type_of_change = null;
          return result;
        }
      }

      // RC - end

      result.valid = true;
      result.msg = "";
      result.reservation = reservation;
      return result;
    },
    validateDuplicateReservationSingle: function (requested_for, start, end) {
      var reservationGr = new GlideRecord(
        WSDConstants.TABLES.RoomsReservation.name
      );
      reservationGr.addActiveQuery();
      reservationGr.addQuery("requested_for", requested_for);
      reservationGr.addQuery("start", "<", end);
      reservationGr.addQuery("end", ">=", start);
      reservationGr.query();
      return reservationGr.hasNext();
    },
    getUserNameFromID: function (userID) {
      var user = new GlideRecord("sys_user");
      user.get(userID);
      return user.name + "";
    },

    /*
         To find whether building's capacity is exceeded or not
 
         @buildingSysId - String - sys_id of building record
         @startGdt - GlideDateTime object - start time
         @endGdt - GlideDateTime object - end time
         */
    isBuildingCapacityExceeded: function (buildingSysId, startGdt, endGdt) {
      var wsdReservationUtils = new WSDReservationUtils();
      return wsdReservationUtils.isBuildingCapacityExceeded(
        buildingSysId,
        startGdt,
        endGdt
      );
    },

    type: "WSDReservationValidator",
  }
);
