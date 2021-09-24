var WSDAvailabilityService = Class.create();
WSDAvailabilityService.prototype = Object.extendsObject(
  WSDAvailabilityServiceSNC,
  {
    type: "WSDAvailabilityService",
    /**
     * RC - debugging error ; added bunch of try catches for same purpose
     * Returns if a reservable is available at a certain time, possible to specify existing sys_id and if reservation details should be included
     * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
     * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
     * @param {string|GlideRecord} reservable - sys_id or GlideRecord object of the reservable to check availability on
     * @param {'location'|'configuration_item'} reservableType - type of the reservable see WsdConstants.RESERVABLE_TYPE.
     * @param {number} reservableQuantity - the quantity of the reservable record. If present, and bigger than 1, it indicates a quantifiable reservable, and availablity is checked based on accumulated collisions
     * @param {string|string[]} [reservationSysIds] - existing reservation sys_id, used to see if trying to adjust meeting etc
     * @param {boolean} [includeReservationsWithinDays] - include all reservations within 00:00 and 23:59 of each day based on the given startGdt and endGdt.
     * @return {AvailabilityResult} - is available and reservations
     */
    checkReservableAvailability: function (
      startGdt,
      endGdt,
      reservable,
      reservableType,
      reservableQuantity,
      reservationSysIds,
      includeReservationsWithinDays
    ) {
      try {
        try {
          var isAvailable = true;
          var reservations = [];
          reservableQuantity =
            !isNaN(reservableQuantity) && reservableQuantity > 0
              ? reservableQuantity
              : 1;
          var isReservablePlaceholderType = reservableQuantity > 1;

          var reservableSysId;
          var reservableGr;
          try {
            if (typeof reservable === "string") {
              // for backward compatibility
              reservableSysId = reservable;
              reservableGr = this.getReservableGr(reservable, reservableType);
            } else {
              if (!reservable.isValidRecord()) {
                WSDLogger.error(
                  "WSDAvailabilityServiceSNC.checkReservableAvailability",
                  "Invalid reservable GlideRecord supplied"
                );
                return {
                  is_available: false,
                  reservations: [],
                };
              }

              reservableGr = reservable;
              reservableSysId = reservableGr.getUniqueValue();
            }
          } catch (error) {
            // gs.error(
            //   "Error in function checkReservableAvailability ; FIRST If Block " +
            //     error
            // );
          }
          // prepare data
          try {
            // Check if location is blocked
            if (reservableType === WSDConstants.RESERVABLE_TYPE.location) {
              var blcLoc = this.blcLocationUtils.isLocationBlockedProcessBuilding(
                reservableGr,
                startGdt,
                endGdt
              );
              if (blcLoc.isBlocked)
                return {
                  is_available: false,
                  reservations: [
                    this._getBlockedLocationDetails(blcLoc.record),
                  ],
                };
            }
          } catch (error) {
            // gs.error(
            //   "Error in function checkReservableAvailability ; SECOND If block " +
            //     error
            // );
          }

          var checkingTimes = this.getDayStartAndDayEnd(startGdt, endGdt);
          var checkingStartGdt = includeReservationsWithinDays
            ? checkingTimes.dayStartGdt
            : startGdt;
          var checkingEndGdt = includeReservationsWithinDays
            ? checkingTimes.dayEndGdt
            : endGdt;
          var reservationGr = this.getReservationsBetweenStartAndEndTime(
            reservableSysId,
            reservableType,
            checkingStartGdt,
            checkingEndGdt
          );

          var quantifiedReservations = [];
          var currentReservable = null;
        } catch (error) {
          //   gs.error(
          //     "Error in function checkReservableAvailability ; OUTSIDE while block " +
          //       error
          //   );
        }
        try {
          while (reservationGr.next()) {
            var rsvSysId = reservationGr.getValue("sys_id");
            var blockerForId = reservationGr.getValue("blocker_for");

            if (
              reservationSysIds &&
              (reservationSysIds.indexOf(rsvSysId) !== -1 ||
                reservationSysIds.indexOf(blockerForId) !== -1)
            ) {
              WSDLogger.debug(
                "WSDAvailabilityServiceSNC.checkReservableAvailability",
                "Original reservation found while checking availability: " +
                  reservableSysId
              );

              if (includeReservationsWithinDays)
                reservations.push(
                  this._getReservationObjectFromGlideRecord(
                    reservationGr,
                    false
                  )
                );

              continue;
            }

            // checking collisions
            var isCollided = this._isReservationCollided(
              reservationGr,
              startGdt,
              endGdt
            );
            if (isReservablePlaceholderType) {
              // placeholder unit (quantifiable)
              if (isCollided)
                quantifiedReservations.push(
                  this._getReservationMatchingData(
                    reservationGr,
                    currentReservable
                  )
                );

              var rsvBlock = this._flattenReservationBlock(
                quantifiedReservations
              );
              if (rsvBlock.length >= reservableQuantity) isAvailable = false;
            } else {
              // regular single unit
              if (isCollided) isAvailable = false;
            }

            // only include reservation in the result if it's collided or includeReservationsWithinDays is set to true
            if (includeReservationsWithinDays || isCollided) {
              var reservation = this._getReservationObjectFromGlideRecord(
                reservationGr,
                isCollided
              );
              reservations.push(reservation);
            }
          }
        } catch (error) {
          //   gs.error(
          //     "Error in function checkReservableAvailability ; within while block " +
          //       error
          //   );
        }

        return {
          is_available: isAvailable,
          reservations: reservations,
        };
      } catch (error) {
        // gs.error("Error in function checkReservableAvailability " + error);
      }
    },

    /** RC - not required now
     * Evaluate a list of reservables' availabilities at a certain time (also check against their own reservations)
     * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
     * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
     * @param {string} reservableIds - sys_ids (or emails) of reservables to check availability on (comma separated input)
     * @param {string} reservableType - type of the reservable
     * @param {string|string[]} [reservationSysIds] - existing reservation sys_id, used to see if trying to adjust meeting etc
     * @param {string} reservableTable - name of the table containing the reservables.
     * @param {string} [reservableQuantityField] - name of the field to check for reservation capacity.
     * @return {AvailabilityResult[]} - is available and reservations
     */
    checkReservablesAvailabilities: function (
      startGdt,
      endGdt,
      reservableIds,
      reservableType,
      reservationSysIds,
      reservableTable,
      reservableQuantityField
    ) {
      try {
        gs.warn(
          "RC - in checkReservableAvailabilities function , reservableIds value is " +
            reservableIds
        );

        var availabilityResult = [];

        if (
          WSDUtils.nullOrEmpty(reservableIds) ||
          !startGdt ||
          !endGdt ||
          !reservableTable
        ) {
          WSDLogger.error(
            "WSDAvailabilityServiceSNC.checkReservablesAvailabilities",
            "Insufficient data for availability check",
            {
              reservableIds: reservableIds,
              startGdt: typeof startGdt,
              endGdt: typeof endGdt,
              reservableTable: reservableTable,
            }
          );
          return availabilityResult;
        }

        var reservableGr = new GlideRecord(reservableTable);
        reservableGr
          .addQuery("sys_id", "IN", reservableIds)
          .addOrCondition("email", "IN", reservableIds);

        reservableGr.query();

        while (reservableGr.next()) {
          var reservableQuantity =
            reservableQuantityField &&
            !isNaN(reservableGr.getValue(reservableQuantityField))
              ? parseInt(reservableGr.getValue(reservableQuantityField))
              : 1;
          var availability = this.checkReservableAvailability(
            startGdt,
            endGdt,
            reservableGr,
            reservableType,
            reservableQuantity,
            reservationSysIds,
            false
          );
          var availableUnit = this._createReservableUnit(
            reservableGr,
            availability
          );
          availabilityResult.push(availableUnit);
        }

        return availabilityResult;
      } catch (error) {
        // gs.error("Error in checkReservablesAvailabilities function " + error);
      }
    },
  }
);
