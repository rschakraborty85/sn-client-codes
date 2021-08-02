var WSDSearchService = Class.create();
WSDSearchService.prototype = Object.extendsObject(WSDSearchServiceSNC, {
  type: "WSDSearchService",

  /**
   * RC - customized for one click research
   * Search for available reservable unit based on search filter, reservable type (table & filter), start and end time
   * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {boolean} requireApproval - indicate whether the reservable requires an approval flow
   * @param {string} reservableTable - target table name
   * @param {string} [reservableFilter] - encoded query that is configured in the reservable module
   * @param {string} [extraConditions] - extra encoded query that will be used to filter out reservable - should not overlap with the reservable filter
   * @param {string[]} [reservableColumns] - columns of the reservable record, used as output properties
   * @param {string} [reservableType] - the type of the reservable, to use when checking reservables.
   * @param {string} [selectionType] - unit or container
   * @param {string} [reservableContainerField] - field of the container within the reservable table (example: reservable table is Space, container field is area)
   * @param {string} [reservableQuantityField] - name of the field to check for reservation capacity.
   * @param {string} [reservationSysId] - existing reservation sys_id, used to see if trying to adjust meeting etc
   * @param {string} [reservedReservableIds] - list of reserved sysIds (comma separated)
   * @param {boolean} [includeUnavailableUnits] - include units that are unavailable
   * @param {boolean} [includeReservationsWithinDays] - include all reservation of the unit from start of the day, till end of the day based on the given times
   * @param {boolean} [includeStandardServices] - include standard services if applicable
   * @param {boolean} [includeReservablePurposes] - include reservable purposes if applicable
   * @param {number} [nextItemIndex] - the first row to include (indicates the first row index to start windowing) (0 on the first page)
   * @param {number} [pageSize] - ammount of records to return
   * @param {?string} [sortBy] - how to sort reservables (anything falsy will skip sorting)
   * @param {boolean} [requireCostCenterDepartmentCheck] - Check to match space's Cost Center / Department with User's Cost Center / Department while search
   * @return {ReservableSearchOutput} - search result including filter data and possible container data
   */
  searchForReservableUnits: function (
    startGdt,
    endGdt,
    requireApproval,
    reservableTable,
    reservableFilter,
    extraConditions,
    reservableColumns,
    reservableType,
    selectionType,
    reservableContainerField,
    reservableQuantityField,
    reservationSysId,
    reservedReservableIds,
    includeUnavailableUnits,
    includeReservationsWithinDays,
    includeStandardServices,
    includeReservablePurposes,
    nextItemIndex,
    pageSize,
    sortBy,
    requireCostCenterDepartmentCheck
  ) {
    var reservableSearchOutput = {
      hasMore: false,
      reservableUnits: [],
      reservableContainers: [],
      nextItemIndex: -1,
    };
    var hasReservedReservables = !WSDUtils.nullOrEmpty(reservedReservableIds);
    var hasNextItemIndex =
      typeof nextItemIndex === "number" && !isNaN(nextItemIndex);
    var searchLimit = this.getSearchLimit();

    reservableColumns = WSDUtils.arrayHasElement(reservableColumns)
      ? reservableColumns
      : ["sys_id", "name"];

    // get the reservables which are reserved first, and only if the call is for the first request (not on pagination, paginated calls will ignore reserved items)
    if (!hasNextItemIndex && hasReservedReservables) {
      var resolvedReservedItemsResult = this._fetchReservedUnitsOnSearch(
        startGdt,
        endGdt,
        requireApproval,
        reservableTable,
        reservableFilter,
        reservableColumns,
        reservableType,
        selectionType,
        reservableContainerField,
        reservableQuantityField,
        reservationSysId,
        reservedReservableIds,
        includeReservationsWithinDays,
        includeStandardServices,
        includeReservablePurposes,
        sortBy
      );

      reservableSearchOutput.reservableUnits =
        resolvedReservedItemsResult.reservableUnits;
      reservableSearchOutput.reservableContainers =
        resolvedReservedItemsResult.reservableContainers;
    }

    /** ACTUAL SEARCH */
    var reservableEQArr = [];
    var parsedExtraConditions =
      this._resolveExtraConditionEncodedQuery(extraConditions);

    if (!WSDUtils.nullOrEmpty(reservableFilter))
      reservableEQArr.push(reservableFilter);

    if (hasReservedReservables)
      // add ignore included reserved reservables condition
      reservableEQArr.push("sys_idNOT IN" + reservedReservableIds);

    var reservableEQ = reservableEQArr.join("^").replace(/\^EQ/, "");

    // get page size
    if (typeof pageSize !== "number" || isNaN(pageSize))
      pageSize = WSDUtils.getDefaultPageSize();

    // verify nextItemIndex
    var windowStart = 0;
    if (hasNextItemIndex && nextItemIndex >= 0) windowStart = nextItemIndex;

    var windowEnd = windowStart + searchLimit;

    var reservableGr = new GlideRecord(reservableTable);
    // when reservableEQ is empty or invalid, fall back to default
    if (!WSDUtils.nullOrEmpty(reservableEQ))
      reservableGr.addEncodedQuery(reservableEQ);

    this._addApplicableReservableTableQuery(
      reservableGr,
      parsedExtraConditions
    );

    if (sortBy) {
      var sortByField =
        selectionType ===
        WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container
          ? reservableContainerField
          : this.DEFAULT_SORT_FIELD;
      this._addSortQuery(sortBy, reservableGr, sortByField);
    }

    reservableGr.chooseWindow(windowStart, windowEnd);

    // Assignment Type and Cost Center / Department queries
    if (this._isSpaceMgmtApplicable(reservableType))
      this._addSpaceMgmtQueries(
        reservableGr,
        parsedExtraConditions,
        requireCostCenterDepartmentCheck
      );

    if (
      selectionType ===
        WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container &&
      reservableContainerField
    )
      reservableGr.addNotNullQuery(reservableContainerField);

    gs.info(
      "RC one click - query for search at api " + reservableGr.getEncodedQuery()
    );

    reservableGr.query();

    WSDLogger.debug(
      "WSDSearchServiceSNC.searchForReservableUnits",
      "Constructed (primary) query on search",
      {
        table: reservableTable,
        encodedQuery: reservableGr.getEncodedQuery(),
      }
    );

    // adding one to check if there is more to request to load
    var pageSizePlusOne =
      pageSize - reservableSearchOutput.reservableUnits.length + 1;

    // get the reservables
    var resolvedItemsResult = this._resolveReservablesByGr(
      reservableGr,
      startGdt,
      endGdt,
      requireApproval,
      pageSizePlusOne,
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
      reservableSearchOutput.reservableContainers
    );

    var allPossibleMatchedItems = reservableSearchOutput.reservableUnits.concat(
      resolvedItemsResult.reservableUnits
    );

    // resolve and construct the applicable filter data that matches reservables result
    reservableSearchOutput.filter = this._resolveAndConstructFilterData(
      reservableType,
      allPossibleMatchedItems
    );
    reservableSearchOutput.totalProcessed = resolvedItemsResult.totalProcessed;

    reservableSearchOutput.reservableUnits = allPossibleMatchedItems.filter(
      function (item) {
        return item.includedInResult || item.is_reserved;
      }
    );

    // resolve possible pagination data
    reservableSearchOutput.hasMore =
      reservableSearchOutput.reservableUnits.length >= pageSizePlusOne;
    if (reservableSearchOutput.hasMore) {
      reservableSearchOutput.reservableUnits.pop();
      // nextItemIndex is subtracted by one the 'recordProcessedForResult' includes the index nextItemIndex is at.
      var supposedStartIndex = windowStart - 1;
      reservableSearchOutput.nextItemIndex =
        supposedStartIndex + resolvedItemsResult.recordProcessedForResult;
    }

    return reservableSearchOutput;
  },

  /**
   * RC - override testing
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
   * @param {ReservableUnitCallback} [callback]
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
    callback
  ) {
    reservableContainers = reservableContainers || [];
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
    var hasNonPrimaryConditions =
      WSDUtils.arrayHasElement(nonPrimaryConditions);
    var isSelectionTypeContainer =
      selectionType === WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container;

    // process each reservable unit, check availability and check against extra condition
    //     gs.info(
    //       "RC reservableGr details " +
    //         reservableGr.getTableName() +
    //         " " +
    //         reservableGr.sys_id +
    //         " " +
    //         reservableGr.getEncodedQuery()
    //     );
    while (reservableGr.next()) {
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

        //         gs.info(
        //           "RC before pushing reservableUnit " + JSON.stringify(reservableUnit)
        //         );
        reservableUnits.push(reservableUnit);
      }
    }

    return {
      reservableContainers: reservableContainers,
      reservableUnits: reservableUnits,
      recordProcessedForResult: recordProcessedForResult,
      totalProcessed: totalProcessed,
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
      searchObjWithDisplay.reservable_module =
        this.reservableModuleService.getReservableModuleAsChoiceById(
          searchObj.reservable_module
        );

    if (searchObj.shift) {
      // fetch shift data
      searchObjWithDisplay.shift =
        this.shiftService.validateShiftIsAvailableTodayAndGetDetails(
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
