var WSDSearchService = Class.create();
WSDSearchService.prototype = Object.extendsObject(WSDSearchServiceSNC, {
  type: "WSDSearchService",

  // RC - overriding for testing -- added class and sysid field to make primary condition
  SEARCHABLE_LOCATION_COLUMNS: [
    "area",
    "floor",
    "building",
    "capacity",
    "email",
    "sys_class_name",
    "sys_id",
  ],
  // RC - overriding for testing purposes
  SUPPORTED_GR_OPERATION: [">=", "=", "!=", "IN", "CONTAINS", "ISNOTEMPTY"],
  /**
   * Not ideal logic but will work as of now - 24th aug 21
   * find module based on area select = true / false of building
   * @param {sys_id/string} buildingID
   * @returns {Object} building and reservable module
   */
  getReservableModuleAndBuilding: function (buildingID) {
    //gs.info("RC function called");
    var AREA_TRUE = gs.getProperty(
      "sn_wsd_rsv.reservable_module.query.area_select_true"
    );
    var AREA_FALSE = gs.getProperty(
      "sn_wsd_rsv.reservable_module.query.area_select_false"
    );
    var buildingModuleObj = this.getBuildingFromId(buildingID);
    // gs.info("RC Building " + JSON.stringify(buildingModuleObj));

    var moduleGr = new GlideRecord(WSDConstants.TABLES.ReservableModule.name);

    if (buildingModuleObj.area_select_seat) {
      moduleGr.addEncodedQuery(AREA_TRUE);
    } else if (!buildingModuleObj.area_select_seat) {
      moduleGr.addEncodedQuery(AREA_FALSE);
    }
    moduleGr.query();
    while (moduleGr.next()) {
      var id = moduleGr.sys_id + "";
      if (this._userCanAccessModule(id)) {
        buildingModuleObj.reservable_module = id;
        return JSON.stringify(buildingModuleObj);
      }
    }
  },
  /**
   * check if user can access a given reservable module
   * got reference from WSDReservationValidatorSNC > validateReservableModule
   * @param {String/sys_id} reservableModuleId
   * @returns
   */
  _userCanAccessModule: function (reservableModuleId) {
    var userCriteriaUtils = new WSDUserCriteriaUtils();
    var userCriteriaAccess = userCriteriaUtils.canAccess(
      WSDConstants.TABLES.ModuleUserCriteria.name,
      "reservable_module",
      reservableModuleId
    );

    if (userCriteriaAccess) {
      return true;
    }
    return false;
  },
  /**
   * RC Overriding for testing
   * preparing search gliderecord on reservable table by taking parsed extra condition array and apply that to the reservable gliderecord
   * @param {GlideRecord} reservableGr - target reservable table glideRecord
   * @param {ParsedCondition[]|undefined} parsedExtraConditions - parsed conditions
   * @private
   */
  _addApplicableReservableTableQuery: function (
    reservableGr,
    parsedExtraConditions
  ) {
    // gs.info(
    //   "RC parsedExtraConditions " + JSON.stringify(parsedExtraConditions)
    // );
    if (!parsedExtraConditions) return;

    for (var j = 0; j < parsedExtraConditions.length; j++) {
      var parsedCondition = parsedExtraConditions[j];
      if (parsedCondition.isPrimaryCondition)
        reservableGr.addQuery(
          parsedCondition.key,
          parsedCondition.operation,
          parsedCondition.value
        );
    }
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
    try {
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
      var hasNonPrimaryConditions = WSDUtils.arrayHasElement(
        nonPrimaryConditions
      );
      var isSelectionTypeContainer =
        selectionType ===
        WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container;

      // process each reservable unit, check availability and check against extra condition
      // gs.info(
      //   "RC reservableGr details " +
      //     reservableGr.getRowCount() +
      //     " " +
      //     reservableGr.getTableName() +
      //     " " +
      //     reservableGr.sys_id +
      //     " " +
      //     reservableGr.getEncodedQuery()
      // );
      try {
        while (reservableGr.next()) {
          totalProcessed++;
          if (!resultCompleted) recordProcessedForResult++;

          // when there is a non primary extra condition: prepare the reservable unit output first
          var reservableUnit = null;
          try {
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
          } catch (error) {
            gs.error(
              "Error in function _resolveReservablesByGr ; specific IF within while block " +
                error
            );
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

          try {
            var availability = this.availabilityService.checkReservableAvailability(
              startGdt,
              endGdt,
              reservableGr,
              reservableType,
              reservableQuantity,
              reservationSysId,
              includeReservationsWithinDays
            );
          } catch (error) {
            gs.error(
              "Error in function _resolveReservablesByGr ; specific to while block and availabilityService " +
                error
            );
          }

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
      } catch (error) {
        gs.error(
          "Error in function _resolveReservablesByGr ; specific to while block " +
            error
        );
      }

      return {
        reservableContainers: reservableContainers,
        reservableUnits: reservableUnits,
        recordProcessedForResult: recordProcessedForResult,
        totalProcessed: totalProcessed,
      };
    } catch (error) {
      gs.error("Error in function _resolveReservablesByGr " + error);
    }
  },

  /**
   * RC Overrdding
   * Gets the display values for the searchObj
   * @param {object} searchObj
   * @returns {InitSearchConfig}
   */

  _resolveSearchConfigData: function (searchObj) {
    try {
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
      try {
        if (searchObj.reservable_module)
          searchObjWithDisplay.reservable_module = this.reservableModuleService.getReservableModuleAsChoiceById(
            searchObj.reservable_module
          );
      } catch (error) {
        gs.error("Error in getReservableModuleAsChoiceById function2 " + error);
      }

      if (searchObj.shift) {
        // fetch shift data
        searchObjWithDisplay.shift = this.shiftService.validateShiftIsAvailableTodayAndGetDetails(
          searchObj.shift
        );
      }

      if (searchObj.sortBy) searchObjWithDisplay.sortBy = searchObj.sortBy;

      //gs.info("RC in WSDSearchService , json looks like " + JSON.stringify(searchObjWithDisplay));
      return searchObjWithDisplay;
    } catch (error) {
      gs.error("Error in _resolveSearchConfigData function " + error);
    }
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
      searchObj = this.getUserBuildingFromWorkplaceProfile();
    else searchObj = JSON.parse(searchObjStr);

    // if user has supplied a pre selected module via the url, overwrite this.
    if (preSelectedReservableModule) {
      searchObj.reservable_module = preSelectedReservableModule;
    }
    try {
      return this._resolveSearchConfigData(searchObj);
    } catch (error) {
      gs.error("Error in getInitSearchConfig function " + error);
    }
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

  /*
	Below functions are overridden as part of story : STRY2456995:Workspace Search Changes - Workplace Reservation Management
	- search
	- _resolveAndConstructFilterData
	- _sortFilterData
	- _getContainerDetails
	- saveSearch
	- _resolveSearchConfigData

	Below functions are added.
	- getAreasFromIds
	- getAreaIdsFromSearchQuery
	- getUserArea

	/* Get Current logged user Area from Workplace Profile*/
  getUserBuildingFromWorkplaceProfile: function () {
    var grBuilding = new GlideRecord("sn_wsd_core_workplace_profile");
    var userBuilding = "";
    grBuilding.addEncodedQuery("employee=" + gs.getUserID());
    grBuilding.query();
    if (grBuilding.next()) {
      //gs.warn(gr.workplace_location.getRefRecord().getTableName());
      if (
        grBuilding.workplace_location.getRefRecord().getTableName() ==
          "sn_wsd_core_space" ||
        grBuilding.workplace_location.getRefRecord().getTableName() ==
          "sn_wsd_core_area"
      )
        userBuilding = grBuilding.workplace_location.building.toString();
    }

    if (userBuilding)
      return {
        building: userBuilding,
      };
    else return {};
  },
  getUserArea: function () {
    var grArea = new GlideRecord("sn_wsd_core_workplace_profile");
    var userArea = "";
    grArea.addEncodedQuery("employee=" + gs.getUserID());
    grArea.query();
    if (grArea.next()) {
      //gs.warn(gr.workplace_location.getRefRecord().getTableName());
      if (
        grArea.workplace_location.getRefRecord().getTableName() ==
        "sn_wsd_core_space"
      )
        userArea = grArea.workplace_location.area.toString();
      else if (
        grArea.workplace_location.getRefRecord().getTableName() ==
        "sn_wsd_core_area"
      )
        userArea = grArea.workplace_location.toString();
    }
    return userArea;
  },
  /**
   * search for available units, or containers based on search request and reservable module
   * @param {SearchRequest} searchRequest - search request (from API)
   * @param {ReservableModule} reservableModule - reservable module (fetched from reservable module service)
   * @param {AlternateSearchOptions} alternateSearchOptions - used to override certain options of searchRequest or reservableModule
   * @return {ReservableSearchOutput} - search result including filter data and possible container data
   */
  search: function (searchRequest, reservableModule, alternateSearchOptions) {
    if (!alternateSearchOptions) alternateSearchOptions = {};

    /*
		gs.warn('@@6 + inside search request1 ' + JSON.stringify(searchRequest));
		gs.warn('@@6 + inside search request2 ' + JSON.stringify(reservableModule));
		gs.warn('@@6 + inside search request3 ' + JSON.stringify(alternateSearchOptions));
		gs.warn('@@6 searchCriteria ' + searchRequest.searchCriteria);
		*/
    gs.info(
      "RC in search service " +
        JSON.stringify(searchRequest) +
        "\n" +
        JSON.stringify(reservableModule)
    );
    var userArea = this.getUserArea();

    var areaDefault = false;

    if (
      searchRequest.searchCriteria.indexOf("area") == -1 &&
      searchRequest.is_load &&
      userArea
    ) {
      //gs.warn('@@6 searchCriteria comes here ' + userArea);

      var newSearchCriteria =
        searchRequest.searchCriteria + "^areaIN" + userArea;

      var grCheckAvailability = new GlideRecord(
        reservableModule.reservable_table
      );

      var reservableEQArr = [];
      var parsedExtraConditions = this._resolveExtraConditionEncodedQuery(
        newSearchCriteria
      );

      if (!WSDUtils.nullOrEmpty(reservableModule.reservable_filter))
        reservableEQArr.push(reservableModule.reservable_filter);

      if (!WSDUtils.nullOrEmpty(searchRequest.reserved_reservables))
        // add ignore included reserved reservables condition
        reservableEQArr.push(
          "sys_idNOT IN" + searchRequest.reserved_reservables
        );

      var reservableEQ = reservableEQArr.join("^").replace(/\^EQ/, "");

      // when reservableEQ is empty or invalid, fall back to default
      if (!WSDUtils.nullOrEmpty(reservableEQ))
        grCheckAvailability.addEncodedQuery(reservableEQ);

      this._addApplicableReservableTableQuery(
        grCheckAvailability,
        parsedExtraConditions
      );

      grCheckAvailability.query();
      // gs.info(
      //   "RC in wsd search SI ; grCheckAvailability query is " +
      //     grCheckAvailability.getEncodedQuery()
      // );
      if (grCheckAvailability.next()) {
        searchRequest.searchCriteria = newSearchCriteria;
        areaDefault = true;
      }
    }

    var reservableSearchOutput = this.searchForReservableUnits(
      searchRequest.startGdt,
      searchRequest.endGdt,
      reservableModule.require_approval,
      reservableModule.reservable_table,
      alternateSearchOptions.reservable_filter
        ? alternateSearchOptions.reservable_filter
        : reservableModule.reservable_filter,
      searchRequest.searchCriteria,
      reservableModule.reservable_columns,
      reservableModule.reservable_type,
      reservableModule.selection_type,
      reservableModule.reservable_container_field,
      reservableModule.reservable_quantity_field,
      searchRequest.reservation_ids,
      searchRequest.reserved_reservables,
      searchRequest.include_unavailable_items,
      searchRequest.include_reservations_within_days,
      searchRequest.include_standard_services,
      searchRequest.include_reservable_purposes,
      searchRequest.next_item_index,
      searchRequest.page_size,
      searchRequest.sort_by,
      reservableModule.require_cc_dept_check
    );

    if (
      reservableSearchOutput.filter &&
      reservableSearchOutput.filter.areas &&
      reservableSearchOutput.filter.areas.length == 1 &&
      areaDefault
    )
      reservableSearchOutput.filter.areas[0].selected = true;

    return reservableSearchOutput;
  },

  /**
   * resolving filter data based on the reservable Units search result
   * @param {ReservableUnit[]} reservableUnits - all reservables to construct applicable filters
   * @return {Filter} constructed possible filter data
   * @private
   */
  _resolveAndConstructFilterData: function (reservableType, reservableUnits) {
    var isLocation = reservableType === WSDConstants.RESERVABLE_TYPE.location;

    var filter = isLocation
      ? {
          floors: [],
          standard_services: [],
          reservable_purposes: [],
          areas: [],
        }
      : {};

    if (!isLocation) {
      // filter for configuration-item type search
      WSDLogger.error(
        "WSDSearchService._resolveAndConstructFilterData",
        "Filter construction is not yet supported for reservable type: " +
          reservableType
      );
      return filter;
    }

    // preparing filter for workplace-location search
    // for each reservable unit, extract applicable filters
    for (var i = 0; i < reservableUnits.length; i++) {
      var reservableUnit = reservableUnits[i];

      // construct floors
      if (
        !WSDUtils.arrayContainsElement(
          filter.floors,
          reservableUnit.floor,
          "sys_id"
        )
      )
        filter.floors.push(reservableUnit.floor);

      //gs.info('@@6 : start reservable.area' + reservableUnit.area);
      // construct areas
      if (
        !WSDUtils.arrayContainsElement(
          filter.areas,
          reservableUnit.area,
          "sys_id"
        )
      )
        filter.areas.push(reservableUnit.area);

      //gs.info('@@6 : end reservable.area');
      // construct standard services
      filter.standard_services = this._resolveFilterData(
        reservableUnit,
        filter.standard_services,
        "standard_services"
      );

      // construct reservable purposes
      filter.reservable_purposes = this._resolveFilterData(
        reservableUnit,
        filter.reservable_purposes,
        "reservable_purposes"
      );
    }

    return this._sortFilterData(filter);
  },

  /**
   * sort each filter property alphabetically
   * @param {Filter} filter - determined filter
   * @return {Filter} sorted filter
   * @private
   */
  _sortFilterData: function (filter) {
    // sort filter
    for (var key in filter) {
      if (!filter.hasOwnProperty(key)) continue;

      var sortBy = "name";
      switch (key) {
        case "floors":
          sortBy = "display_value";
          break;
        case "areas":
          sortBy = "display_value";
          break;
        default:
          sortBy = "name";
          break;
      }

      filter[key] = WSDUtils.sortArrOfObjAlphabetically(filter[key], sortBy);
    }

    return filter;
  },

  /**
   * construct container details for reservable and selection type of `container`
   * @param {string} reservableType location or configuration_item
   * @param {GlideRecord} reservableGr current processing reservable item gr
   * @param {string} [reservableContainerField] - field of the container within the reservable table (example: reservable table is Space, container field is area)
   * @return {object} container object
   */
  _getContainerDetails: function (
    reservableType,
    reservableGr,
    reservableContainerField
  ) {
    if (reservableType === WSDConstants.RESERVABLE_TYPE.location) {
      var refRecord =
        !WSDUtils.nullOrEmpty(reservableGr[reservableContainerField]) &&
        reservableGr[reservableContainerField].getRefRecord();

      if (!refRecord || !refRecord.isValidRecord()) return null;

      //gs.info('@@6 ' + this.recordUtils.getReferenceObject(refRecord, 'area'));

      return {
        sys_id: reservableGr.getValue(reservableContainerField),
        display_value: reservableGr.getDisplayValue(reservableContainerField),
        floor: this.recordUtils.getReferenceObject(refRecord, "floor"),
        area: this.recordUtils.getReferenceObject(refRecord, "area"),
        building: this.recordUtils.getReferenceObject(refRecord, "building"),
        campus: this.recordUtils.getReferenceObject(refRecord, "campus"),
        capacity: this.recordUtils.getIntegerFromField(refRecord, "capacity"),
        image: this.recordUtils.getImageFromField(refRecord, "image"),
      };
    }

    // CI
    return this.recordUtils.getReferenceObject(
      reservableGr,
      reservableContainerField
    );
  },
  /**
   * Saves the last searched reservable module and building to the users preferences for using when starting wsd_search in the future
   * @param {string} reservable_module
   * @param {string} [searchQuery]
   */
  saveSearch: function (reservableModule, shift, searchQuery, sortBy) {
    var buildingId = this.getBuildingFromSearchQuery(searchQuery);
    var floorIds = this.getFloorIdsFromSearchQuery(searchQuery);
    var areaIds = this.getAreaIdsFromSearchQuery(searchQuery);

    var searchObj = {
      reservable_module: reservableModule,
      shift: shift,
      building: buildingId,
      floors: floorIds,
      areas: areaIds,
      sortBy: sortBy,
    };

    //gs.info('@@6 - save search ' + JSON.stringify(searchObj))

    var searchObjStr = JSON.stringify(searchObj);
    gs.getUser().savePreference(
      WSDConstants.USER_PREFERENCE.lastSearchRequest,
      searchObjStr
    );
  },

  getAreaIdsFromSearchQuery: function (searchQuery) {
    //gs.info('@@6 start : searchQuery + ' + searchQuery);
    if (searchQuery && typeof searchQuery === "string") {
      var regex = /areaIN([a-zA-Z0-9,]*)/;
      var result = searchQuery.match(regex);

      if (result) return result[1];
    }

    return null;
  },
  /**
   * Gets the display values for the searchObj
   * @param {object} searchObj
   * @returns {InitSearchConfig}
   */
  _resolveSearchConfigData: function (searchObj) {
    if (!searchObj) return {};

    var searchObjWithDisplay = {};
    if (searchObj.building)
      searchObjWithDisplay.building = this.getBuildingFromId(
        searchObj.building
      );

    if (searchObj.floors)
      searchObjWithDisplay.floors = this.getFloorsFromIds(searchObj.floors);

    if (searchObj.areas)
      searchObjWithDisplay.areas = this.getAreasFromIds(searchObj.areas);

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

    if (!WSDUtils.nullOrEmpty(searchObj.sortBy))
      searchObjWithDisplay.sortBy = searchObj.sortBy;

    return searchObjWithDisplay;
  },

  /**
   * Gets the area values of the areas provided
   * @param {string} areaIds
   * @returns {[]|null}
   */
  getAreasFromIds: function (areaIds) {
    if (!areaIds) return null;

    var areas = [];

    var areaGr = new GlideRecord(WSDConstants.TABLES.Area.name);
    areaGr.addQuery("sys_id", "IN", areaIds);
    areaGr.addActiveQuery();
    areaGr.query();

    while (areaGr.next()) {
      areas.push({
        sys_id: areaGr.getUniqueValue(),
        display_value: areaGr.getDisplayValue(),
      });
    }

    return areas;
  },
});
