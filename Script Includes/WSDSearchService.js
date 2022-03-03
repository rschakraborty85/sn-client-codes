var WSDSearchService = Class.create();
WSDSearchService.prototype = Object.extendsObject(WSDSearchServiceSNC, {
  type: "WSDSearchService",

  /** @debug - RC - overriding to test
   * This method is responsible for getting all the filters across the
   * building.
   * @return {Filter} constructed filter data
   * @private
   */
  _resolveAndConstructAllFilterData: function (
    buildingId,
    reservableTable,
    reservableEncodedQuery,
    standardServices,
    reservablePurposes,
    eligibleLocData
  ) {
    try {
      var filter = {
        floors: [],
        standard_services: [],
        reservable_purposes: [],
      };

      var eligibleLocationIds = [];
      // If it is map view, we have already filled this object. We will be populating this object in _checkFloorCriteriaPresentForMap method
      if (this.eligibleLocsAndFloorsForTypeAndBuilding)
        filter.floors = this.eligibleLocsAndFloorsForTypeAndBuilding.floors;
      // If it is not map view, we haven't computed the filter.floors. EligibleLocData is already calculated, we can directly build the floors.
      // @debug RC
      else
        filter.floors = this._getFloorsOfSelectedBuilding(
          buildingId,
          true,
          eligibleLocData.eligibleFloorIds
        );

      // construct standard services
      filter.standard_services = standardServices;

      // construct reservable purposes
      filter.reservable_purposes = reservablePurposes;
      return this._sortFilterData(filter);
    } catch (error) {
      gs.error("RC _resolveAndConstructAllFilterData " + error);
    }
  },

  /**
   * RC - override
   * RC - [11th feb merged code again]
   * RC 17th jan - merged with newly changed oob code
   * For the glideRecord provided, process for available reservable units based on search filter, start and end time
   * @param {GlideRecord} reservableGr - GlideRecord to get reservables from
   * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {boolean} requireApproval - indicate whether the reservable requires an approval flow
   * @param {number} count - number of reservables to return (for pagination, the count is always epxected to be page size + 1)
   * @param {string[]} [reservableColumns] - columns of the reservable record, used as output properties
   * @param {string} [reservableType] - the type of the reservable, to use when checking reservables.
   * @param {ParsedCondition[]} [parsedExtraConditions] - parsed filter conditions
   * @param {string} [reservationSysId] - existing reservation sys_id, used to see if trying to adjust meeting etc
   * @param {boolean} [includeUnavailableUnits] - include units that are unavailable
   * @param {boolean} [includeReservationsWithinDays] - include all reservation of the unit from start of the day, till end of the day based on the given times
   * @param {boolean} [includeStandardServices] - include standard services if applicable
   * @param {boolean} [includeReservablePurposes] - include reservable purposes if applicable
   * @param {string} [selectionType] - unit or container. If `unit`: the result will show all matched units, if `container` the result will show the container/parent of the first matched unit.
   * @param {string} [reservableContainerField] - field of the container within the reservable table (example: reservable table is Space, container field is area)
   * @param {string} [reservableQuantityField] - name of the field to check for reservation capacity.
   * @param {ReservableContainer[]} [reservableContainers] - list of container that has been added for container selection type search
   * @param {number} [bestMatchCount] - when given, the result will return the exact number of reservable (no pagination), the availablity is then only processed until the total number is matched
   * @param {ReservableUnitCallback} [callback]
   * @param {GlideRecord} nearByLocationGr - Glide record of location where near by user belongs to
   * @param {string} [buildingId] - sys_id of the building
   * @param {string} [reservableEncodedQuery] - final reservable encoded query after applying all conditions - cost center, space management etc.
   * @param {string} [reservableTable] - target table name
   * @param {number} [searchLimit] - specifies the window that should be scanned on the reservableTable, will be window end only when nextItemIndex is 0.
   * @param {string} [extraConditions] - extra encoded query that will be used to filter out reservable - should not overlap with the reservable filter
   * @param {string} [view] - tells us about the viewType like : CARD, SCHEDULE, MAP
   * @param {number} [nextItemIndex] - the first row to include (indicates the first row index to start windowing) (0 on the first page)
   * @return {ResolvedReservablesOutput} - array of matched reservable units (the properties of each unit is configured in the reservable module under field: reservable_columns)
   * @private
   */

  _resolveReservablesByGr: function (
    reservableGr,
    startGdt,
    endGdt,
    requireApproval,
    count,
    reservableColumns,
    reservableType,
    parsedExtraConditions,
    reservationSysId,
    includeUnavailableUnits,
    includeReservationsWithinDays,
    includeStandardServices,
    includeReservablePurposes,
    selectionType,
    reservableContainerField,
    reservableQuantityField,
    reservableContainers,
    bestMatchCount,
    callback,
    nearByLocationGr,
    buildingId,
    reservableEncodedQuery,
    reservableTable,
    searchLimit,
    extraConditions,
    view,
    nextItemIndex
  ) {
    reservableContainers = reservableContainers || [];
    bestMatchCount = bestMatchCount || 0;
    var reservableUnits = [];
    var recordProcessedForResult = 0; // total record processed until it reached the included result
    var includedInResultCount = 0;
    var resultCompleted = false;
    var totalProcessed = 0;

    var nonPrimaryConditions = !parsedExtraConditions
      ? null
      : parsedExtraConditions.filter(function (con) {
          return !con.isPrimaryCondition;
        });
    var hasNonPrimaryConditions = WSDUtils.arrayHasElement(
      nonPrimaryConditions
    );
    var isSelectionTypeContainer =
      selectionType === WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container;
    var eligibleLocIds;
    var eligibleLocData; //Object which stores the eligibleLocIds and areas, floors and buildings of the eligibleLocIds.
    var reservationData, eligibleLocAreaFloorBuildingIds;
    var standardServices = [],
      reservablePurposes = [];

    //In map view and Facet filter OFF, we are already fetching the eligibleLocationsData in _checkFloorMapCriteria function.
    if (this.eligibleLocsAndFloorsForTypeAndBuilding) {
      eligibleLocData = this.eligibleLocsAndFloorsForTypeAndBuilding
        .eligibleLocData;
      eligibleLocIds = eligibleLocData.eligibleLocationIds;
    }

    /* Cache the standard services and reservable purposes available for each reservable in reseravable module
        If includeStandardServices is true, then cache the standardservices for all the reservables in reservable module.*/
    if (includeStandardServices) {
      if (!eligibleLocIds) {
        eligibleLocData = this._getEligibleLocData(
          buildingId,
          reservableTable,
          reservableEncodedQuery,
          nearByLocationGr,
          searchLimit,
          nextItemIndex,
          extraConditions,
          view
        );
        eligibleLocIds = eligibleLocData
          ? eligibleLocData.eligibleLocationIds
          : null;
      }
      //Store the constructed list of standard services available across eligibleLocIds.
      standardServices = eligibleLocIds
        ? this._prepareStandardServicesForEligibleLocs(eligibleLocIds)
        : [];
    }

    /* If includeReservablePurposes is true, then cache the reservablePurposes for all the reservables in reservable module.*/
    if (includeReservablePurposes) {
      if (!eligibleLocIds) {
        eligibleLocData = this._getEligibleLocData(
          buildingId,
          reservableTable,
          reservableEncodedQuery,
          nearByLocationGr,
          searchLimit,
          nextItemIndex,
          extraConditions,
          view
        );
        eligibleLocIds = eligibleLocData
          ? eligibleLocData.eligibleLocationIds
          : null;
      }
      //Store the constructed list of reservable purposes available across eligibleLocIds.
      reservablePurposes = eligibleLocIds
        ? this._prepareReservablePurposesForEligibleLocs(eligibleLocIds)
        : [];
    }

    eligibleLocData = eligibleLocData
      ? eligibleLocData
      : this._getEligibleLocData(
          buildingId,
          reservableTable,
          reservableEncodedQuery,
          nearByLocationGr,
          searchLimit,
          nextItemIndex,
          extraConditions,
          view
        );
    eligibleLocIds = eligibleLocData
      ? eligibleLocData.eligibleLocationIds
      : null;
    eligibleLocAreaFloorBuildingIds = eligibleLocData
      ? eligibleLocData.eligibleLocationIds +
        "," +
        eligibleLocData.eligibleAreaIds +
        "," +
        eligibleLocData.eligibleFloorIds +
        "," +
        eligibleLocData.eligibleBuildingId
      : null; //Concatenated string of eligible loc, area, floor and building Ids - used in blockLocation query of availability checking

    //Prepare the reservationData for the eligibleLocations before processing (improves search page load performance)
    reservationData = this.availabilityService.prepareReservationData(
      eligibleLocIds,
      reservableType,
      startGdt,
      endGdt,
      includeReservationsWithinDays
    );

    // process each reservable unit, check availability and check against extra condition

    // '_getReservableGrIterator' function returns the pointer to next GlideRecord and in case of proximity based search it returns a new instance of GlideRecord
    // of next nearest location (TODO: Think of better approach other than creating the new instance of GlideRecord for each while loop which is time consuming)
    while (
      (reservableGr = this._getReservableGrIterator(
        reservableGr,
        nearByLocationGr
      )).next()
    ) {
      // Stop processing if in near by user mode and result is completed
      if (
        nearByLocationGr &&
        nearByLocationGr.isValidRecord() &&
        resultCompleted
      )
        break;
      totalProcessed++;
      if (!resultCompleted) recordProcessedForResult++;

      // when there is a non primary extra condition: prepare the reservable unit output first
      var reservableUnit = null;
      if (
        hasNonPrimaryConditions &&
        (includeStandardServices || includeReservablePurposes)
      ) {
        reservableUnit = this.getReservableOutput(
          reservableGr,
          reservableType,
          reservableColumns,
          requireApproval,
          includeStandardServices,
          includeReservablePurposes
        );

        // check if reservable unit satisfy the nonprimary conditions
        if (
          !this._isReservableMatchedExtraConditions(
            reservableUnit,
            nonPrimaryConditions
          )
        )
          continue;
      }

      if (
        isSelectionTypeContainer &&
        WSDUtils.nullOrEmpty(reservableGr[reservableContainerField])
      )
        continue;

      var reservableQuantity =
        reservableQuantityField &&
        !isNaN(reservableGr.getValue(reservableQuantityField))
          ? parseInt(reservableGr.getValue(reservableQuantityField))
          : 1;

      var availability = this.availabilityService.checkReservableAvailability(
        startGdt,
        endGdt,
        reservableGr,
        reservableType,
        reservableQuantity,
        reservationSysId,
        includeReservationsWithinDays
      );

      var includeReservable =
        includeUnavailableUnits || availability.is_available;
      if (includeReservable) {
        reservableUnit = reservableUnit
          ? reservableUnit
          : this.getReservableOutput(
              reservableGr,
              reservableType,
              reservableColumns,
              requireApproval,
              includeStandardServices,
              includeReservablePurposes
            );
        reservableUnit.is_available = availability.is_available;
        reservableUnit.reservations = availability.reservations;
        reservableUnit.availableTimes = availability.availableTimes;

        if (callback) callback(reservableGr, reservableUnit);

        if (isSelectionTypeContainer) {
          // CONTAINER selection type: process container data (only available must be included)
          reservableUnit.container = this._getContainerDetails(
            reservableType,
            reservableGr,
            reservableContainerField
          ); // reservableUnit[reservableContainerField];
          if (
            reservableUnit.container &&
            !WSDUtils.arrayContainsElement(
              reservableContainers,
              reservableUnit.container,
              "sys_id"
            ) &&
            reservableUnit.is_available
          ) {
            if (includedInResultCount < count) {
              reservableContainers.push(reservableUnit.container);
              reservableUnit.includedInResult = true;
              includedInResultCount++; // increase the number of records that will be included in the result
            }
          }
        } else {
          // UNIT selection type, process with normal pagination
          if (includedInResultCount < count) {
            reservableUnit.includedInResult = true;
            includedInResultCount++; // increase the number of records that will be included in the result
          }
        }

        // re-evaluate and check if the expected paginated result is completed
        if (includedInResultCount === count) resultCompleted = true;

        reservableUnits.push(reservableUnit);
        if (bestMatchCount > 0 && reservableUnits.length >= bestMatchCount)
          break;
      }
    }
    this.cacheUtils.clearCache(); //Clear the cache after the while loop.
    return {
      reservableContainers: reservableContainers,
      reservableUnits: reservableUnits,
      recordProcessedForResult: recordProcessedForResult,
      recordProcessedForResult: recordProcessedForResult,
      totalProcessed: totalProcessed,
      standardServices: standardServices,
      reservablePurposes: reservablePurposes,
      eligibleLocData: eligibleLocData,
    };
  },

  /**
   * RC Overrdding
   * Gets the display values for the searchObj
   * @param {object} searchObj
   * @returns {InitSearchConfig}
   */

  _resolveSearchConfigData: function (searchObj) {
    if (!searchObj) return {};
    //gs.info("RC searchObj " + JSON.stringify(searchObj));
    var searchObjWithDisplay = {};
    if (searchObj.building) {
      searchObjWithDisplay.building = this.getBuildingFromId(
        searchObj.building
      );
      searchObjWithDisplay.time_zone_info = this.getUserBuildingTZ(
        searchObj.building
      );
    }

    if (searchObj.reservable_module)
      searchObjWithDisplay.reservable_module = this.reservableModuleService.getReservableModuleAsChoiceById(
        searchObj.reservable_module
      );

    if (searchObj.shift) {
      // fetch shift data
      searchObjWithDisplay.shift = this.shiftService.validateShiftIsAvailableTodayAndGetDetails(
        searchObj.shift
      );
    }

    if (searchObj.sortBy) searchObjWithDisplay.sortBy = searchObj.sortBy;

    //gs.info("RC in WSDSearchService , json looks like " + JSON.stringify(searchObjWithDisplay));
    return searchObjWithDisplay;
  },

  /**
   * RC - Overriding
   * Gets the display value and sysid of the building provided
   * @param {string} buildingId
   * @returns {object|null}
   */
  getBuildingFromId: function (buildingId) {
    if (!buildingId) return null;

    var buildingGr = new GlideRecord(WSDConstants.TABLES.Building.name);
    buildingGr.addQuery("sys_id", buildingId);
    buildingGr.addActiveQuery();
    buildingGr.query();
    if (!buildingGr.next()) return null;

    return {
      sys_id: buildingId,
      display_value: buildingGr.getValue("u_display_name"),
      name: buildingGr.getValue("u_display_name"), // on frontend, we use name as display
      area_select_seat: this._getBuildingAreaSelectSeat(buildingGr),
    };
  },
  // RC - get whether "select seat" is true or false for the building
  _getBuildingAreaSelectSeat: function (buildingGr) {
    var areaGR = new GlideRecord(WSDConstants.TABLES.Area.name);
    areaGR.addActiveQuery();
    areaGR.addQuery("building", buildingGr.sys_id);
    areaGR.addQuery("u_select_seat", true);
    areaGR.query();
    return areaGR.hasNext();
  },
  /**
   * RC - Overriding
   * Returns the initial search config to show on wsd_search.
   * Either returns the previous search (via user preferences) or the users building
   * @param preSelectedReservableModule sys_id of a module that was preSelected
   * via e.g. url parameters
   * @returns {InitSearchConfig}
   */
  getInitSearchConfig: function (preSelectedReservableModule) {
    var searchObj;
    var searchObjStr = gs
      .getUser()
      .getPreference(WSDConstants.USER_PREFERENCE.lastSearchRequest);
    //gs.info("RC searchObjStr " + searchObjStr.toString());
    if (!searchObjStr || searchObjStr.length === 0)
      searchObj = this.getFirstSearchConfig();
    else searchObj = JSON.parse(searchObjStr);

    // if user has supplied a pre selected module via the url, overwrite this.
    if (preSelectedReservableModule) {
      searchObj.reservable_module = preSelectedReservableModule;
    }

    return this._resolveSearchConfigData(searchObj);
  },
  // RC
  getBuildingGrObject: function (buildingSysId) {
    if (!buildingSysId) return null;
    var buildingGr = new GlideRecord(WSDConstants.TABLES.Building.name);
    buildingGr.addQuery("sys_id", buildingSysId);
    buildingGr.addActiveQuery();
    buildingGr.query();
    if (buildingGr.next()) return buildingGr;
    return null;
  },
  // RC
  getUserBuildingTZ: function (buildingSysId) {
    var bGR = this.getBuildingGrObject(buildingSysId);
    var userTz = gs.getSession().getTimeZoneName();
    var userDateTimeNow = new GlideDateTime().getDisplayValue();
    var localTime = global.rmConvertTimeZone(
      userDateTimeNow,
      userTz,
      bGR.time_zone.toString()
    );
    var warnMsg = gs.getMessage("user_building_tz_diff", [
      userTz,
      bGR.time_zone.toString() + " {Local time : " + localTime + "}",
    ]);
    return {
      user_tz: userTz,
      building_tz: bGR.time_zone.toString(),
      warning_msg: warnMsg,
      local_time: localTime,
    };
  },
});
