// custom type definitions can be found at the bottom of the file.

var WSDSearchServiceSNC = Class.create();
WSDSearchServiceSNC.prototype = {
  DEFAULT_PAGE_SIZE: 8,
  DEFAULT_DAYS_TO_SEARCH_RSV: 7,
  DEFAULT_MAXIMUM_NUMBER_OF_RECORD: 100, //default for maximum number of record to process
  DEFAULT_SORT_FIELD: "name",
  SEARCHABLE_LOCATION_COLUMNS: ["floor", "building", "capacity", "email"],
  SUPPORTED_GR_OPERATION: [">=", "=", "IN", "CONTAINS", "ISNOTEMPTY"], // the order of the operation indicates which operation will be matched and used first.

  /** @member {WSDAvailabilityService} availabilityService */
  availabilityService: null,

  /** @member {WSDRecordUtils} recordUtils */
  recordUtils: null,

  /** @member {WSDStandardServicesHelper} standardServiceHelper */
  standardServiceHelper: null,

  /** @member {WSDReservablePurposesService} reservablePurposeService */
  reservablePurposeService: null,

  /** @member {WSDReservableModuleService} reservableModuleService */
  reservableModuleService: null,

  /** @member {WSDShiftService} shiftService */
  shiftService: null,

  /** @member {WSDTimeSlotService} timeSlotService */
  timeSlotService: null,

  /** @member {sn_wsd_core.WSDProximityUtils}  wpProximityUtils */
  wpProximityUtils: null,

  initialize: function () {
    this.availabilityService = new WSDAvailabilityService();
    this.recordUtils = new WSDRecordUtils();
    this.standardServiceHelper = new WSDStandardServicesHelper();
    this.reservablePurposeService = new WSDReservablePurposesService();
    this.reservableModuleService = new WSDReservableModuleService();
    this.shiftService = new WSDShiftService();
    this.timeSlotService = new WSDTimeSlotService();
    this.wpProximityUtils = new sn_wsd_core.WPProximityUtils();
    this.cacheUtils = new WSDCacheUtils();
  },

  /**
   * search for available unit(s) or container(s) based on search request and reservable module
   * @param {SearchRequest} searchRequest - search request (from API)
   * @param {ReservableModule} reservableModule - reservable module (fetched from reservable module service)
   * @param {AlternateSearchOptions} [alternateSearchOptions] - used to override certain options of searchRequest or reservableModule
   * @return {ReservableSearchOutput} - search result including filter data and possible container data
   */
  search: function (searchRequest, reservableModule, alternateSearchOptions) {
    if (!alternateSearchOptions) alternateSearchOptions = {};

    var searchLimit = this.getSearchLimit(reservableModule.search_limit);

    return this.searchForReservableUnits(
      searchRequest.startGdt,
      searchRequest.endGdt,
      reservableModule.buildingSysIds,
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
      reservableModule.require_cc_dept_check,
      searchRequest.view,
      reservableModule.enable_facet_filter,
      searchLimit,
      searchRequest.near_by_location_id
    );
  },

  /**
   * Search for available units or containers based on search request, reservable module and best match count. The default for best match count is 1
   * Different from the regular search, the moment the number of specified best match count is reached, operation & availability operation is stopped.
   * @param {SearchRequest} searchRequest - search request (from API)
   * @param {ReservableModule} reservableModule - reservable module (fetched from reservable module service)
   * @param {AlternateSearchOptions} [alternateSearchOptions] - used to override certain options of searchRequest or reservableModule
   * @return {ReservableSearchOutput} - search result including filter data and possible container data
   */
  searchForBestMatch: function (
    searchRequest,
    reservableModule,
    alternateSearchOptions
  ) {
    var reservableSearchOutput = {
      hasMore: false,
      reservableUnits: [],
      reservableContainers: [],
      nextItemIndex: -1,
    };
    var searchLimit = this.getSearchLimit(reservableModule.search_limit);

    reservableColumns = WSDUtils.arrayHasElement(
      reservableModule.reservable_columns
    )
      ? reservableModule.reservable_columns
      : ["sys_id", "name"];

    var reservableFilter = alternateSearchOptions.reservable_filter
      ? alternateSearchOptions.reservable_filter
      : reservableModule.reservable_filter;
    var reservableTable = reservableModule.reservable_table;
    var reservableModuleBuildingSysIds = reservableModule.buildingSysIds;

    //glide record of location where near by user belongs to
    var nearByLocationGr, buildingId;

    if (searchRequest.reference_location_id) {
      nearByLocationGr = this._getLocationGr(
        searchRequest.reference_location_id
      );
      // If nearby location is not found or the nearby location building is not assocaited with the reservable module, return empty search output.
      if (
        !nearByLocationGr ||
        !nearByLocationGr.isValidRecord() ||
        reservableModuleBuildingSysIds.indexOf(
          nearByLocationGr.getValue("building")
        ) === -1
      )
        return reservableSearchOutput;

      buildingId = nearByLocationGr.getValue("building");
    }

    //If buildingId is null (not in nearBy mode), get it from searchCriteria.
    buildingId = buildingId
      ? buildingId
      : this.getBuildingFromSearchQuery(searchRequest.searchCriteria);
    reservableSearchOutput.floorsOfSelectedBuilding = this._getFloorsOfSelectedBuilding(
      buildingId
    );

    var queryResult = this._prepareReservableGrQuery(
      reservableModule.reservable_table,
      reservableModule.reservable_type,
      searchRequest.searchCriteria,
      reservableFilter,
      false,
      searchRequest.reserved_reservables,
      reservableModule.selection_type,
      reservableModule.reservable_container_field,
      reservableModule.require_cc_dept_check,
      searchLimit,
      0,
      searchRequest.sort_by,
      searchRequest.view,
      nearByLocationGr
    );

    var reservableGr = queryResult.reservableGr;
    var parsedExtraConditions = queryResult.parsedExtraConditions;
    var reservableEncodedQuery = queryResult.reservableEncodedQuery;

    //Query the search glideRecord after applying the necessary query conditions.
    reservableGr.query();

    var bestMatchCount = WSDUtils.getZeroPositiveNumber(
      searchRequest.best_match_count,
      1
    );
    var resolvedItemsResult = this._resolveReservablesByGr(
      reservableGr,
      searchRequest.startGdt,
      searchRequest.endGdt,
      reservableModule.require_approval,
      1,
      reservableColumns,
      reservableModule.reservable_type,
      parsedExtraConditions,
      searchRequest.reservation_ids,
      false,
      searchRequest.include_reservations_within_days,
      searchRequest.include_standard_services,
      searchRequest.include_reservable_purposes,
      reservableModule.selection_type,
      reservableModule.reservable_container_field,
      reservableModule.reservable_quantity_field,
      reservableSearchOutput.reservableContainers,
      bestMatchCount,
      null,
      nearByLocationGr,
      buildingId,
      reservableEncodedQuery,
      reservableTable,
      searchLimit,
      searchRequest.searchCriteria,
      null,
      0
    );

    reservableSearchOutput.reservableUnits =
      resolvedItemsResult.reservableUnits;

    return reservableSearchOutput;
  },

  /**
   * Search for available reservable unit based on search filter, reservable type (table & filter), start and end time
   * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {string} reservableModuleBuildingSysIds - sys_id(s) of the buildings assocaited with the reservableModule.
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
   * @param {string} [view] - tells us about the viewType like : CARD, SCHEDULE, MAP
   * @param {boolean} [enableFacetFilter] - If TRUE, we need to build filters on the available locations. If FALSE we need to build filters on all the eligible locations irrespective of availability
   * @param {number} [searchLimit] - specifies the window that should be scanned on the reservableTable
   * @param {String} nearByLocationId - sys_id of location reserved by the nearby user.
   * @return {ReservableSearchOutput} - search result including filter data and possible container data
   */
  searchForReservableUnits: function (
    startGdt,
    endGdt,
    reservableModuleBuildingSysIds,
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
    requireCostCenterDepartmentCheck,
    view,
    enableFacetFilter,
    searchLimit,
    nearByLocationId
  ) {
    var showAllFilters = !enableFacetFilter;
    var nearByLocationGr = null;
    var buildingId = null;
    var reservableSearchOutput = {
      hasMore: false,
      reservableUnits: [],
      reservableContainers: [],
      nextItemIndex: -1,
    };

    if (!WSDUtils.nullOrEmpty(nearByLocationId)) {
      nearByLocationGr = this._getLocationGr(nearByLocationId);
      // If nearby location is not found or the nearby location building is not assocaited with the reservable module, return empty search output.
      if (
        !nearByLocationGr ||
        !nearByLocationGr.isValidRecord() ||
        reservableModuleBuildingSysIds.indexOf(
          nearByLocationGr.getValue("building")
        ) === -1
      )
        return reservableSearchOutput;
      else {
        buildingId = nearByLocationGr.getValue("building");
        this.wpProximityUtils.setNextItemIndex(
          isNaN(nextItemIndex) ? 0 : nextItemIndex
        );
      }
    }

    var hasReservedReservables = !WSDUtils.nullOrEmpty(reservedReservableIds);
    var hasNextItemIndex =
      typeof nextItemIndex === "number" && !isNaN(nextItemIndex);

    if (!hasNextItemIndex || nextItemIndex < 0) nextItemIndex = 0;

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

    buildingId = buildingId
      ? buildingId
      : this.getBuildingFromSearchQuery(extraConditions);

    var queryResult = this._prepareReservableGrQuery(
      reservableTable,
      reservableType,
      extraConditions,
      reservableFilter,
      hasReservedReservables,
      reservedReservableIds,
      selectionType,
      reservableContainerField,
      requireCostCenterDepartmentCheck,
      searchLimit,
      nextItemIndex,
      sortBy,
      view,
      nearByLocationGr
    );
    var reservableGr = queryResult.reservableGr;
    var parsedExtraConditions = queryResult.parsedExtraConditions;
    var reservableEncodedQuery = queryResult.reservableEncodedQuery;

    var defaultFloorIdForMapView = this._checkFloorCriteriaPresentForMap(
      reservableSearchOutput,
      extraConditions,
      buildingId,
      view,
      showAllFilters,
      reservableTable,
      reservableEncodedQuery,
      nearByLocationGr,
      searchLimit,
      nextItemIndex
    );

    //If defaultFloorIdForMapView is not null, add the floor criteria in reservable query and in parsedExtraConditions.
    if (!gs.nil(defaultFloorIdForMapView)) {
      reservableGr.addQuery("floor", "IN", defaultFloorIdForMapView);
      reservableEncodedQuery = reservableGr.getEncodedQuery();

      var extraCondition = "floorIN" + defaultFloorIdForMapView;
      parsedExtraConditions = this._addExtraCondition(
        parsedExtraConditions,
        extraCondition
      );
    }

    //Query the search glideRecord after applying the necessary query conditions.
    reservableGr.query();

    // adding one to check if there is more to request to load
    if (typeof pageSize !== "number" || isNaN(pageSize))
      pageSize = WSDUtils.getDefaultPageSize();

    var pageSizePlusOne = this._evaluatePageSizePlusOne(
      pageSize,
      reservableSearchOutput.reservableUnits.length,
      view
    );

    var bestMatchCount = null;
    if (showAllFilters)
      /* If Facet Filters are disabled i.e. showingAllFilters is enabled. Then we need not to scan all the locations that
			 fall under the searchLimit */
      bestMatchCount = pageSizePlusOne;

    // get the reservables
    // @debug RC
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
      reservableSearchOutput.reservableContainers,
      bestMatchCount,
      null,
      nearByLocationGr,
      buildingId,
      reservableEncodedQuery,
      reservableTable,
      searchLimit,
      extraConditions,
      view,
      nextItemIndex
    );

    var allPossibleMatchedItems = reservableSearchOutput.reservableUnits.concat(
      resolvedItemsResult.reservableUnits
    );

    /* Get the constructed list of standard services and reservable purposes available across eligibleLocIds.
		   (reduces the calculation of standard services and reservable purposes in filter construction when facet filter OFF) */
    var standardServices = resolvedItemsResult.standardServices;
    var reservablePurposes = resolvedItemsResult.reservablePurposes;

    // Get the eligibleLocData calculated in resolveReservableByGr and use this in filter construction.
    var eligibleLocData = resolvedItemsResult.eligibleLocData;
    // resolve and construct the applicable filter data that matches reservables result
    reservableSearchOutput.filter = this._constructFilterData(
      reservableType,
      reservableTable,
      reservableEncodedQuery,
      allPossibleMatchedItems,
      buildingId,
      showAllFilters,
      view,
      standardServices,
      reservablePurposes,
      eligibleLocData
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
      var supposedStartIndex = nextItemIndex - 1;
      reservableSearchOutput.nextItemIndex =
        supposedStartIndex + resolvedItemsResult.recordProcessedForResult;
    }

    return reservableSearchOutput;
  },

  /**
   * Search for available reservable unit based on search filter, reservable type (table & filter), start and end time
   * @param {string} [reservableType] - the type of the reservable, to use when checking reservables.
   * @param {string} reservableTable - target table name
   * @param {string} [reservableEncodedQuery] - final reservable encoded query
   * @param {ReservableUnit[]} reservableUnits - all reservables to construct applicable filters
   * @param {string} buildingId - Building Id selected by the user
   * @param {boolean} [enableFacetFilter] - If TRUE, we need to build filters on the available locations. If FALSE we need to build filters on all the eligible locations irrespective of availability
   * @param {Array} standardServices - constructed list of standard services available across all eligible locations irrespective of availability
   * @param {Array} reservablePurposes - constructed list of reservable purposes available across all eligible locations irrespective of availability
   * @param [Object] eligibleLocData - containing eligibleLocations and unique areas, floors and building of the eliglibleLocations
   * @return {Filter} constructed possible filter data
   */
  _constructFilterData: function (
    reservableType,
    reservableTable,
    reservableEncodedQuery,
    reservableUnits,
    buildingId,
    showAllFilters,
    view,
    standardServices,
    reservablePurposes,
    eligibleLocData
  ) {
    if (showAllFilters)
      return this._resolveAndConstructAllFilterData(
        buildingId,
        reservableTable,
        reservableEncodedQuery,
        standardServices,
        reservablePurposes,
        eligibleLocData
      );
    else
      return this._resolveAndConstructFilterData(
        buildingId,
        reservableTable,
        reservableEncodedQuery,
        reservableType,
        reservableUnits,
        view
      );
  },

  /**
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
    var filter = { floors: [], standard_services: [], reservable_purposes: [] };

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
  },

  /**
   * Gets the eligible floors (for map view )based on the reservableTable, reservableEncodedQuery and selected buildingId
   * @param {string} buildingId  - building Id
   * @param {string} reservableTable - target table name
   * @param {string} reservableEncodedQuery - final reservable encoded query
   * @return [Array | null] Array containing eligible floors
   */
  _getEligibleFloorsForMapView: function (
    buildingId,
    reservableTable,
    reservableEncodedQuery
  ) {
    // For map view, we need all the eligible floors without applying the search limit.
    if (gs.nil(reservableTable)) return null;

    var eligibleFloors = {};
    var reservableGr = new GlideRecord(reservableTable);

    if (!WSDUtils.nullOrEmpty(reservableEncodedQuery))
      reservableGr.addEncodedQuery(reservableEncodedQuery);
    if (!WSDUtils.nullOrEmpty(buildingId))
      reservableGr.addQuery("building", buildingId);

    reservableGr.query();

    while (reservableGr.next()) {
      var floorId = reservableGr.getValue("floor").toString();
      if (!WSDUtils.nullOrEmpty(floorId)) eligibleFloors[floorId] = true;
    }

    return Object.keys(eligibleFloors);
  },

  /**
   * Gets the reservableLocation Ids based on the reservableTable, reservableEncodedQuery, selected buildingId and within the search limit
   * @param {string} buildingId  - building Id
   * @param {string} reservableTable - target table name
   * @param {string} reservableEncodedQuery - final reservable encoded query
   * @param {GlideRecord} nearByLocationGr - GlideRecord of the nearBy user location
   * @param {number} [searchLimit] - specifies the window that should be scanned on the reservableTable, will be window end only when nextItemIndex is 0.
   * @param {number} [nextItemIndex] - the first row to include (indicates the first row index to start windowing) (0 on the first page)
   * @param {string} [extraConditions] - extra encoded query that will be used to filter out reservable - should not overlap with the reservable filter
   * @param {string} [view] - tells us about the viewType like : CARD, SCHEDULE, MAP
   * @return [Object | null] Object containing eligibleLocations and unique areas, floors and building of the eliglibleLocations
   */
  _getEligibleLocData: function (
    buildingId,
    reservableTable,
    reservableEncodedQuery,
    nearByLocationGr,
    searchLimit,
    nextItemIndex,
    extraConditions,
    view
  ) {
    if (gs.nil(reservableTable)) return null;

    var eligibleLocationsIds = [];
    var eligibleFloors = {};
    var eligibleAreas = {};
    var eligibleBuilding = [];

    eligibleBuilding.push(buildingId);
    var reservableGr = new GlideRecord(reservableTable);

    if (!WSDUtils.nullOrEmpty(reservableEncodedQuery))
      reservableGr.addEncodedQuery(reservableEncodedQuery);
    if (!WSDUtils.nullOrEmpty(buildingId))
      reservableGr.addEncodedQuery("building=" + buildingId);

    // Applying the search limit on reservables to restrict the eligibleLocations (improves search page performance).
    var windowStart = 0;
    if (
      typeof nextItemIndex === "number" &&
      !isNaN(nextItemIndex) &&
      nextItemIndex >= 0
    )
      windowStart = nextItemIndex;
    var windowEnd = windowStart + searchLimit;
    this._applyWindowOperation(
      reservableGr,
      windowStart,
      windowEnd,
      view,
      extraConditions,
      nearByLocationGr
    );

    reservableGr.query();

    while (reservableGr.next()) {
      eligibleLocationsIds.push(reservableGr.getUniqueValue().toString());
      var floorId = reservableGr.getValue("floor").toString();
      var areaId = reservableGr.getValue("area");
      if (!WSDUtils.nullOrEmpty(floorId)) eligibleFloors[floorId] = true;

      if (!WSDUtils.nullOrEmpty(areaId)) eligibleAreas[areaId] = true;
    }

    return {
      eligibleLocationIds: eligibleLocationsIds,
      eligibleFloorIds: Object.keys(eligibleFloors),
      eligibleAreaIds: Object.keys(eligibleAreas),
      eligibleBuildingId: eligibleBuilding,
    };
  },

  /**
   * When user first lands on the map view, we default the user to a particular floor
   * @param {ReservableSearchOutput} - search result including filter data and possible container data
   * @param {string} [extraConditions] - extra encoded query that will be used to filter out reservable - should not overlap with the reservable filter
   * @param {string} buildingId  - Building id
   * @param {string} [view] - tells us about the viewType like : CARD, SCHEDULE, MAP
   * @param {boolean} [showAllFilters] - Tells us if the "Enable facet filter" is switched Off
   * @param {string} reservableTable - target table name
   * @param {string} [reservableEncodedQuery] - final reservable encoded query
   * @param {GlideRecord} nearByLocationGr - GlideRecord of the nearBy user location
   * @param {number} [searchLimit] - specifies the window that should be scanned on the reservableTable
   * @param {number} [nextItemIndex] - the first row to include (indicates the first row index to start windowing) (0 on the first page)
   * @return {String | null} - sys_id of the default floor of map view or null
   */
  _checkFloorCriteriaPresentForMap: function (
    reservableSearchOutput,
    extraConditions,
    buildingId,
    view,
    showAllFilters,
    reservableTable,
    reservableEncodedQuery,
    nearByLocationGr,
    searchLimit,
    nextItemIndex
  ) {
    /*
			In map view with enableFacetFilter switched ON, we are having 2 API calls.
			1. To get all the filters which are required to show based on the selected buildingId alone.
			2. To get the availability of the selected floor in the map
			
			showAllFilters means "Enable facet filter" is OFF 
			
			In case if the reservable module is configured to 'showing all the filters' (i.e. Enable facet filter is OFF) irrespective of available locations,
			then we are getting the availability in the 1st API call itself and also sending all the applicable filters in
			the 1st call itself.
						
		*/
    if (view === WSDConstants.SEARCH_VIEW.map_view && showAllFilters) {
      var floorId = this.getFloorIdsFromSearchQuery(extraConditions);
      if (WSDUtils.nullOrEmpty(floorId)) {
        /* Get all the floors which we will be sending as part of the filters, and take the 1st floor which has externalId.
				   In map view, we need to show all the floors (irrespective of search limit) but eligibleLocations will be restricted based on the search limit */

        var floorsOfCurrentBuildingForMap;
        var eligibleFloorIdsForMapView = this._getEligibleFloorsForMapView(
          buildingId,
          reservableTable,
          reservableEncodedQuery
        );
        if (eligibleFloorIdsForMapView && eligibleFloorIdsForMapView.length > 0)
          floorsOfCurrentBuildingForMap = this._getFloorsOfSelectedBuilding(
            buildingId,
            true,
            eligibleFloorIdsForMapView
          );

        this.eligibleLocsAndFloorsForTypeAndBuilding = {
          eligibleLocData: this._getEligibleLocData(
            buildingId,
            reservableTable,
            reservableEncodedQuery,
            nearByLocationGr,
            searchLimit,
            nextItemIndex,
            extraConditions,
            view
          ),
          floors: floorsOfCurrentBuildingForMap,
        };

        var floorsWithMap = floorsOfCurrentBuildingForMap.filter(function (
          floor
        ) {
          return !gs.nil(floor.external_id);
        });

        if (floorsWithMap.length == 0) return null;

        reservableSearchOutput.defaultFloorForMapView = floorsWithMap[0];
        return floorsWithMap[0].sys_id;
      }
      return null;
    } else return null;
  },

  /**
   * prepare GlideRecord based on the search request and reservable module configuration...
   * @param {string} reservableTable  - target table name
   * @param {string} reservableType - the type of the reservable, to use when checking reservables.
   * @param {string} [extraConditions] - extra encoded query that will be used to filter out reservable - should not overlap with the reservable filter
   * @param {string} [reservableFilter] - encoded query that is configured in the reservable module
   * @param {boolean} [hasReservedReservables] - whether the request included reserved reservable ids
   * @param {string} [reservedReservableIds] - reserved reservable ids
   * @param {string} [selectionType] - unit or container
   * @param {string} [reservableContainerField] - field of the container within the reservable table (example: reservable table is Space, container field is area)
   * @param {boolean} [requireCostCenterDepartmentCheck] - Check to match space's Cost Center / Department with User's Cost Center / Department while search
   * @param {number} [searchLimit] - the limited number of row to window and evaluate availablity upon.
   * @param {number} [nextItemIndex] - index to start searching from
   * @param {string} [sortBy]  - how to sort reservables (anything falsy will skip sorting)
   * @param {string} [view] - tells us about the viewType like : CARD, SCHEDULE, MAP
   * @param {GlideRecord} nearByLocationGr - Glide record of location where near by user belongs to
   * @returns { reservableGr: GlideRecord, parsedExtraConditions: string, reservableEncodedQuery: string } - the search GlideRecord with added query conditions,the parsed extra condition string and the final reservable encoded query after applying all conditions such as cost center check, space management conditions etc
   */
  _prepareReservableGrQuery: function (
    reservableTable,
    reservableType,
    extraConditions,
    reservableFilter,
    hasReservedReservables,
    reservedReservableIds,
    selectionType,
    reservableContainerField,
    requireCostCenterDepartmentCheck,
    searchLimit,
    nextItemIndex,
    sortBy,
    view,
    nearByLocationGr
  ) {
    var reservableEQArr = [];
    var parsedExtraConditions = this._resolveExtraConditionEncodedQuery(
      extraConditions
    );

    if (!WSDUtils.nullOrEmpty(reservableFilter))
      reservableEQArr.push(reservableFilter);

    if (hasReservedReservables)
      // add ignore included reserved reservables condition
      reservableEQArr.push("sys_idNOT IN" + reservedReservableIds);

    // If near by user location is available then modify the query to search only in that floor and excluding the near by user space
    if (nearByLocationGr && nearByLocationGr.isValidRecord()) {
      reservableEQArr.push("floor=" + nearByLocationGr.getValue("floor"));
      reservableEQArr.push("sys_id!=" + nearByLocationGr.getUniqueValue());
    }

    var reservableEQ = reservableEQArr.join("^").replace(/\^EQ/, "");

    // verify nextItemIndex
    var windowStart = 0;
    if (
      typeof nextItemIndex === "number" &&
      !isNaN(nextItemIndex) &&
      nextItemIndex >= 0
    )
      windowStart = nextItemIndex;

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

    this._applyWindowOperation(
      reservableGr,
      windowStart,
      windowEnd,
      view,
      extraConditions,
      nearByLocationGr
    );

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

    var reservableEncodedQuery = reservableGr.getEncodedQuery();

    WSDLogger.debug(
      "WSDSearchServiceSNC.searchForReservableUnits",
      "Constructed (primary) query on search",
      {
        table: reservableTable,
        encodedQuery: reservableEncodedQuery,
      }
    );

    return {
      reservableGr: reservableGr,
      parsedExtraConditions: parsedExtraConditions,
      reservableEncodedQuery: reservableEncodedQuery,
    };
  },

  /** Get all the floors of a building required for search page
   *  @param {string} searchQuery
   *  @returns {[]|null}
   */
  _getFloorsOfSelectedBuilding: function (
    buildingId,
    sendFloorMapData,
    floorIds
  ) {
    if (gs.nil(buildingId)) return [];

    var floors = [];

    var floorGr = new GlideRecord(WSDConstants.TABLES.Floor.name);
    floorGr.addQuery("building", buildingId);
    floorGr.addActiveQuery();
    if (WSDUtils.arrayHasElement(floorIds))
      floorGr.addQuery("sys_id", "IN", floorIds);
    floorGr.orderBy("name");
    floorGr.query();

    while (floorGr.next()) {
      var floor = {
        sys_id: floorGr.getUniqueValue(),
        display_value: floorGr.getDisplayValue(),
        external_id: floorGr.getValue("external_id"),
        name: floorGr.getValue("name"),
      };

      if (sendFloorMapData)
        floor.mappedinMapData = {
          venueSlug: floorGr.building.external_id
            ? floorGr.building.external_id.toString()
            : "",
          mapId: floorGr.getValue("external_id"),
          title: floorGr.building.getDisplayValue(),
        };

      floors.push(floor);
    }

    return floors;
  },

  /**
   * Get the glideRecord of the location.
   * @param {String} locationId - sys_id of the location
   * @param {String} reservableTable  - target table name
   * @return {GlideRecord | null} glideRecord of the locationId if valid, null otherwise.
   */
  _getLocationGr: function (locationId, reservableTable) {
    if (WSDUtils.nullOrEmpty(reservableTable))
      reservableTable = WSDConstants.TABLES.Space.name;

    var locationGr = new GlideRecord(reservableTable);
    locationGr.addQuery("sys_id", locationId);
    locationGr.addActiveQuery();
    locationGr.query();

    if (locationGr.next()) return locationGr;
    else return null;
  },

  /**
   * We need calculate the pageSizePlusOne based on the view and amount of reserved units
   * If its not map view, we will consider the search limit
   * If the amount of reserved units is greater then the page size it will determine the page size needed to fill the next page
   * @param {number} pageSize - Page size used in pagination
   * @param {number} reservedUnitsLength - length of the reserved units
   * @param {string} view - view type like: CARD, SCHEDULE, MAP
   * @return {number}
   */
  _evaluatePageSizePlusOne: function (pageSize, reservedUnitsLength, view) {
    if (view === WSDConstants.SEARCH_VIEW.map_view) return Number.MAX_VALUE;

    var amountToFillPage = pageSize - (reservedUnitsLength % pageSize);
    return ++amountToFillPage;
  },

  /**
   * We will be applying the search window operation to the reservableGr based on the view type.
   * If its map view, we need to scan all the location of the floor.
   * If its not map view, we will consider the search limit
   * @param {GlideRecord} reservableGr - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {number} windowStart - Start position of the search window
   * @param {number} windowEnd - End position of the search window
   * @param {string} view - view type like: CARD, SCHEDULE, MAP
   * @param {GlideRecord} nearByLocationGr - Glide record of location where near by user belongs to
   */
  _applyWindowOperation: function (
    reservableGr,
    windowStart,
    windowEnd,
    view,
    extraConditions,
    nearByLocationGr
  ) {
    var floorIdInQuery = this.getFloorIdsFromSearchQuery(extraConditions);
    // We do not apply chooseWindow only if its a map view and extraConditions have atleast 1 floorId, if we do not apply chooseWindow in this scenario, we will be scanning he whole building locations.

    if (
      (nearByLocationGr && nearByLocationGr.isValidRecord()) ||
      (view === WSDConstants.SEARCH_VIEW.map_view && !gs.nil(floorIdInQuery))
    )
      return;
    reservableGr.chooseWindow(windowStart, windowEnd);
  },

  /**
   * fetch reservable units of reserved items (should always be appended first)
   * @param {GlideDateTime} startGdt - start time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {GlideDateTime} endGdt - end time in the internal GDT format YYYY-MM-DD HH:mm:ss
   * @param {boolean} requireApproval - indicate whether the reservable requires an approval flow
   * @param {string} reservableTable - target table name
   * @param {string} [reservableFilter] - encoded query that is configured in the reservable module
   * @param {string[]} [reservableColumns] - columns of the reservable record, used as output properties
   * @param {string} [reservableType] - the type of the reservable, to use when checking reservables.
   * @param {string} [selectionType] - unit or container
   * @param {string} [reservableContainerField] - field of the container within the reservable table (example: reservable table is Space, container field is area)
   * @param {string} [reservableQuantityField] - name of the field to check for reservation capacity.
   * @param {string} [reservationSysId] - existing reservation sys_id, used to see if trying to adjust meeting etc
   * @param {string} [reservedReservableIds] - list of reserved sysIds (comma separated)
   * @param {boolean} [includeReservationsWithinDays] - include all reservation of the unit from start of the day, till end of the day based on the given times
   * @param {boolean} [includeStandardServices] - include standard services if applicable
   * @param {boolean} [includeReservablePurposes] - include reservable purposes if applicable
   * @param {?string} [sortBy] - how to sort reservables (anything falsy will skip sorting)
   * @return {ResolvedReservablesOutput}  list of resolved reserved units and other resolved details for RESERVED items
   * @private
   */
  _fetchReservedUnitsOnSearch: function (
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
  ) {
    // get the reservables which are reserved first, and only if first request (not on pagination)
    var reservedReservablesGr = new GlideRecord(reservableTable);
    reservedReservablesGr.addEncodedQuery("sys_idIN" + reservedReservableIds);
    if (sortBy) {
      var sortByField =
        selectionType ===
        WSDConstants.RESERVABLE_MODULE_SELECTION_TYPE.container
          ? reservableContainerField
          : this.DEFAULT_SORT_FIELD;
      this._addSortQuery(sortBy, reservedReservablesGr, sortByField);
    }
    reservedReservablesGr.query();

    return this._resolveReservablesByGr(
      reservedReservablesGr,
      startGdt,
      endGdt,
      requireApproval,
      reservedReservableIds.split(",").length, // length should be the number of records.
      reservableColumns,
      reservableType,
      null,
      reservationSysId,
      true,
      includeReservationsWithinDays,
      includeStandardServices,
      includeReservablePurposes,
      selectionType,
      reservableContainerField,
      reservableQuantityField,
      null,
      0,
      function (reservableGr, reservableUnit) {
        reservableUnit.is_available =
          reservableUnit.is_available &&
          (!reservableFilter ||
            GlideFilter.checkRecord(reservableGr, reservableFilter));
        reservableUnit.is_reserved = true;
        reservableUnit.is_selected = true;
      }
    );
  },

  /**
   * Gets the maximum number of record to process. This is not pagination size, this is the total amount of records that will be return for a search query before processing availability
   * @param {number} resvModuleSearchLimit - this is the searchLimit that is specified on the reservable module. This is used only when Facet Filters are turned OFF
   * @return {number}
   */
  getSearchLimit: function (resvModuleSearchLimit) {
    var searchLimit = resvModuleSearchLimit;

    if (!isNaN(searchLimit) && searchLimit > 0) return searchLimit;

    // If the reservableModule searchLimit is not valid use the sys_property
    searchLimit = WSDUtils.getIntProperty(
      WSDConstants.SYSTEM_PROPERTY.searchLimit
    );
    if (!isNaN(searchLimit) && searchLimit > 0) return searchLimit;

    return this.DEFAULT_MAXIMUM_NUMBER_OF_RECORD;
  },

  /**
   * preparing search gliderecord on reservable table by taking parsed extra condition array and apply that to the reservable gliderecord
   * @param {GlideRecord} reservableGr - target reservable table glideRecord
   * @param {ParsedCondition[]|undefined} parsedExtraConditions - parsed conditions
   * @private
   */
  _addApplicableReservableTableQuery: function (
    reservableGr,
    parsedExtraConditions
  ) {
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
   * parse extracondition query string into meaningful object, and prevent duplicated key
   * @param {string} extraConditionsEncodedQuery - extra condition encoded query
   * @return {ParsedCondition[]|null} array of parsed condition
   * @private
   */
  _resolveExtraConditionEncodedQuery: function (extraConditionsEncodedQuery) {
    if (WSDUtils.nullOrEmpty(extraConditionsEncodedQuery)) return null;

    var conditionResult = [];
    var conditionArr = extraConditionsEncodedQuery.split("^");
    for (var i = 0; i < conditionArr.length; i++) {
      var parsedCondition = this._parseSingleCondition(conditionArr[i]);

      // if condition already included, ignore duplicated condition
      if (
        parsedCondition &&
        !WSDUtils.arrayContainsElement(conditionResult, parsedCondition, "key")
      )
        conditionResult.push(parsedCondition);
    }

    return conditionResult.length > 0 ? conditionResult : null;
  },

  /**
   * Add the given extraCondition to the parsedExtraConditions after parsing.
   * @param {ParsedCondition[]} parsedExtraConditions - array of parsed condition
   * @param {String} extraCondition - extra condition string
   * @return {ParsedCondition[]} array of parsed condition
   * @private
   */
  _addExtraCondition: function (parsedExtraConditions, extraCondition) {
    var parsedCondition = this._parseSingleCondition(extraCondition);
    // if condition already included, ignore duplicated condition
    if (
      parsedCondition &&
      !WSDUtils.arrayContainsElement(
        parsedExtraConditions,
        parsedCondition,
        "key"
      )
    )
      parsedExtraConditions.push(parsedCondition);

    return parsedExtraConditions;
  },

  /**
   * parse a single string condition into an object with representative properties (based on supported operation)
   * @param {string} condition - condition as encodedQuery (example: building=xxxx; or: capacity>=5, or: standard_services=xxx,xxx)
   * @return {ParsedCondition} parsed condition
   * @private
   */
  _parseSingleCondition: function (condition) {
    var possibleOperation = this.SUPPORTED_GR_OPERATION;

    for (var i = 0; i < possibleOperation.length; i++) {
      var arrPair = this._parseSingleConditionToArrayPairUsingKey(
        condition,
        possibleOperation[i]
      );
      if (arrPair) {
        // primary condition implies such condition is applicable on the targeted reservable table.
        var isPrimaryCondition =
          this.SEARCHABLE_LOCATION_COLUMNS.indexOf(arrPair[0]) >= 0;

        return {
          key: arrPair[0],
          value: arrPair[1],
          operation: possibleOperation[i],
          isPrimaryCondition: isPrimaryCondition,
          origin: condition,
        };
      }
    }

    return null;
  },

  /**
   * parse a single condition into a key pair value based on the operation key
   * @param {string} condition - a single condition of enconded query
   * @param {string} operationKey - possible condition operation (=, IN or CONTAINS)
   * @return {boolean} if the condition is correct
   * @private
   */
  _parseSingleConditionToArrayPairUsingKey: function (condition, operationKey) {
    var arr = condition.split(operationKey);

    return arr.length === 2 ? arr : null;
  },

  /**
   * resolving filter data based on the reservable Units search result
   * @param {ReservableUnit[]} reservableUnits - all reservables to construct applicable filters
   * @return {Filter} constructed possible filter data
   * @private
   */
  _resolveAndConstructFilterData: function (
    buildingId,
    reservableTable,
    reservableEncodedQuery,
    reservableType,
    reservableUnits,
    view
  ) {
    var isLocation = reservableType === WSDConstants.RESERVABLE_TYPE.location;
    var filter = isLocation
      ? { floors: [], standard_services: [], reservable_purposes: [] }
      : {};

    if (!isLocation) {
      // filter for configuration-item type search
      WSDLogger.error(
        "WSDSearchServiceSNC._resolveAndConstructFilterData",
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
        view !== WSDConstants.SEARCH_VIEW.map_view &&
        !WSDUtils.arrayContainsElement(
          filter.floors,
          reservableUnit.floor,
          "sys_id"
        )
      ) {
        filter.floors.push(reservableUnit.floor);
      }

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

    // If its map view, every time we send floors which are eligible for that building and reservable module
    if (view === WSDConstants.SEARCH_VIEW.map_view) {
      var eligibleFloorIdsForMapView = this._getEligibleFloorsForMapView(
        buildingId,
        reservableTable,
        reservableEncodedQuery
      );

      if (eligibleFloorIdsForMapView && eligibleFloorIdsForMapView.length > 0)
        filter.floors = this._getFloorsOfSelectedBuilding(
          buildingId,
          true,
          eligibleFloorIdsForMapView
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
        default:
          sortBy = "name";
          break;
      }

      filter[key] = WSDUtils.sortArrOfObjAlphabetically(filter[key], sortBy);
    }

    return filter;
  },

  /**
   * construct filter data for standard services and reservable purposes
   * @param {ReservableUnit} reservableUnit - a single reservable to construct applicable filters
   * @param {StandardService[]|ReservablePurpose[]} filterList - target filter
   * @param {string} filterType - type of filter
   * @return {StandardService[]|ReservablePurpose[]}
   * @private
   */
  _resolveFilterData: function (reservableUnit, filterList, filterType) {
    if (!WSDUtils.arrayHasElement(reservableUnit[filterType]))
      return filterList;

    for (var j = 0; j < reservableUnit[filterType].length; j++) {
      var obj = reservableUnit[filterType][j];
      if (!WSDUtils.arrayContainsElement(filterList, obj, "sys_id"))
        filterList.push(obj);
    }

    return filterList;
  },

  /**
   * Caches the reservable purposes available for each eligible location and returns constructed list of reservable purposes available across eligible locations.
   * @param {String} eligibleLocIds - array of sys_id(s) of the locations
   * @return {Array} - constructed list of reservable purposes available across eligible locations.
   * @private
   */
  _prepareReservablePurposesForEligibleLocs: function (eligibleLocIds) {
    if (eligibleLocIds.length === 0) return;

    //Querying the locReservablePurpose records of the locations which satisfy the reservable filter conditions.
    var locReservablePurposeGr = new GlideRecord(
      WSDConstants.TABLES.LocReservablePurpose.name
    );
    locReservablePurposeGr.addQuery("workplace_location", "IN", eligibleLocIds);
    locReservablePurposeGr.addActiveQuery();
    locReservablePurposeGr.query();

    if (!locReservablePurposeGr.hasNext()) return [];

    return this._prepareLocReservablePurposeList(locReservablePurposeGr);
  },

  /**
   * Cache the reservable purpose available for each location and return constructed list of reservable purposes.
   * @param {GlideRecord} locReservablePurposeGr - GlideRecord of the location reservable purpose.
   * @private
   */
  _prepareLocReservablePurposeList: function (locReservablePurposeGr) {
    var visitedLocPurposes = {};
    var cachedLocRsvPurposeData = {};
    var reservablePurposeList = []; //Stores the unique reservable purposes avaialble across all eligibleLocations.

    while (locReservablePurposeGr.next()) {
      var location = locReservablePurposeGr.getValue("workplace_location");
      if (!cachedLocRsvPurposeData[location])
        cachedLocRsvPurposeData[location] = [];

      var reservablePurposeId = locReservablePurposeGr.getValue(
        "reservable_purpose"
      );
      if (visitedLocPurposes[location + "_" + reservablePurposeId]) continue;

      //If the object for the reservablePurpose is already cached, get the object from the cache.
      var cachedRsvPurposeData = this.cacheUtils.get(reservablePurposeId);
      if (cachedRsvPurposeData)
        cachedLocRsvPurposeData[location].push(cachedRsvPurposeData);
      else {
        //If cache miss, get the object from getObjectFromGlideRecord and cache it.
        var reservablePurposeData = this.recordUtils.getObjectFromGlideRecord(
          locReservablePurposeGr.reservable_purpose.getRefRecord(),
          WSDConstants.TABLES.LocReservablePurpose.columns
        );
        cachedLocRsvPurposeData[location].push(reservablePurposeData);
        this.cacheUtils.put(reservablePurposeId, reservablePurposeData);
        //Push the unique reservable purpose into reservablePurposeList.
        reservablePurposeList.push(reservablePurposeData);
      }

      visitedLocPurposes[location + "_" + reservablePurposeId] = true;
    }
    //For each location, sort the reservable purpose objects according to name field
    var locations = Object.keys(cachedLocRsvPurposeData);
    for (var i = 0; i < locations.length; i++) {
      var locReservablePurposeList = cachedLocRsvPurposeData[locations[i]];
      this.cacheUtils.put(
        locations[i],
        {
          reservablePurposes: WSDUtils.sortArrOfObjAlphabetically(
            locReservablePurposeList,
            "name"
          ),
        },
        true
      );
    }
    return WSDUtils.sortArrOfObjAlphabetically(reservablePurposeList, "name");
  },

  /**
   * Caches the standard services available for each eligible location and returns constructed list of standard services available across eligible locations.
   * @param {String} eligibleLocIds - array of sys_id(s) of the locations
   * @return {Array} - constructed list of standard services available across eligible locations.
   * @private
   */
  _prepareStandardServicesForEligibleLocs: function (eligibleLocIds) {
    if (eligibleLocIds.length === 0) return;

    //Querying the locStandardService records of the locations which satisfy the reservable filter conditions.
    var locStandardServiceGr = new GlideRecord(
      WSDConstants.TABLES.LocStandardService.name
    );
    locStandardServiceGr.addQuery("workplace_location", "IN", eligibleLocIds);
    locStandardServiceGr.addActiveQuery();
    locStandardServiceGr.query();

    if (!locStandardServiceGr.hasNext()) return [];

    return this._prepareLocStandardServiceList(locStandardServiceGr);
  },

  /**
   * Cache the standard services available for each location and return constructed list of standard services.
   * @param {GlideRecord} locStandardServiceGr - GlideRecord of the location standard service.
   * @private
   */
  _prepareLocStandardServiceList: function (locStandardServiceGr) {
    var visitedStdServices = {};
    var cachedLocStdServiceData = {};
    var standardServiceList = []; //Stores the unique standard services avaialble across all eligibleLocations.

    while (locStandardServiceGr.next()) {
      var location = locStandardServiceGr.getValue("workplace_location");
      if (!cachedLocStdServiceData[location])
        cachedLocStdServiceData[location] = [];

      var standardServiceId = locStandardServiceGr.getValue("standard_service");
      if (visitedStdServices[location + "_" + standardServiceId]) continue;

      //If the object for the standardService is already cached, get the object from the cache.
      var cachedStdServiceData = this.cacheUtils.get(standardServiceId);
      if (cachedStdServiceData)
        cachedLocStdServiceData[location].push(cachedStdServiceData);
      else {
        //If cache miss, get the object from getObjectFromGlideRecord and cache it.
        var standardServiceData = this.recordUtils.getObjectFromGlideRecord(
          locStandardServiceGr.standard_service.getRefRecord(),
          WSDConstants.TABLES.LocStandardService.columns
        );
        cachedLocStdServiceData[location].push(standardServiceData);
        this.cacheUtils.put(standardServiceId, standardServiceData);
        //Push the unique standard service into standardServiceList.
        standardServiceList.push(standardServiceData);
      }
      visitedStdServices[location + "_" + standardServiceId] = true;
    }
    //For each location, sort the standard service objects according to name field
    var locations = Object.keys(cachedLocStdServiceData);
    for (var i = 0; i < locations.length; i++) {
      var locStandardServiceList = cachedLocStdServiceData[locations[i]];
      this.cacheUtils.put(locations[i], {
        standardServices: WSDUtils.sortArrOfObjAlphabetically(
          locStandardServiceList,
          "name"
        ),
      });
    }
    return WSDUtils.sortArrOfObjAlphabetically(standardServiceList, "name");
  },
  /**
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
        includeReservationsWithinDays,
        reservationData,
        eligibleLocAreaFloorBuildingIds
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
      totalProcessed: totalProcessed,
      standardServices: standardServices,
      reservablePurposes: reservablePurposes,
      eligibleLocData: eligibleLocData,
    };
  },

  /*
   * Get reservable glide record iterator
   * @param {GlideRecord} reservableGr current processing reservable item gr
   * @param {GlideRecord} nearByLocationGr - Glide record of location where near by user belongs to
   * @return {GlideRecord} - Iterator pointing to glide record
   */
  _getReservableGrIterator: function (reservableGr, nearByLocationGr) {
    if (nearByLocationGr && nearByLocationGr.isValidRecord())
      return this.wpProximityUtils.getNextReservableGr(
        nearByLocationGr,
        reservableGr
      );
    else return reservableGr;
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

      return {
        sys_id: reservableGr.getValue(reservableContainerField),
        display_value: reservableGr.getDisplayValue(reservableContainerField),
        floor: this.recordUtils.getReferenceObject(refRecord, "floor"),
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
   * check on the constructed reservable unit object, against the parsed, and nonprimary condition (condition that are not based on original table's columns).
   * Note: Future scalability can be expanded by checking on condition, dynamic configurable values.
   * @param {ReservableUnit} reservableUnit - the constructed reservable unit object
   * @param {ParsedCondition[]} [nonPrimaryConditions] - parsed conditions of non-primary type
   * @return {boolean}
   * @private
   */
  _isReservableMatchedExtraConditions: function (
    reservableUnit,
    nonPrimaryConditions
  ) {
    if (!WSDUtils.arrayHasElement(nonPrimaryConditions)) return true;

    for (var i = 0; i < nonPrimaryConditions.length; i++) {
      // for each condition, validate its against the reservableUnit's property (based on condition key)
      var condition = nonPrimaryConditions[i];
      var arrToVerify = reservableUnit[condition.key];

      switch (condition.key) {
        case "standard_services":
        case "reservable_purposes":
          if (!WSDUtils.arrayHasElement(reservableUnit[condition.key]))
            return false;
          if (
            !this._ArrMatchedConditionValue(
              arrToVerify,
              condition.value,
              condition.operation
            )
          )
            return false;
          break;
        default:
          break;
      }
    }

    return true;
  },

  /**
   * Check if a list of services/purposes satisfies a single conditions value
   * @param {StandardService[]|ReservablePurpose[]} arrToVerify - list of services/purposes on the reservable unit (example: standard_services, reservable_purposes)
   * @param {string} conditionValues - string comma separated values
   * @return {boolean}
   * @private
   */
  _ArrMatchedConditionValue: function (arrToVerify, conditionValue, operation) {
    var values = conditionValue.split(",");
    for (var j = 0; j < values.length; j++) {
      var contain = WSDUtils.arrayContainsElement(
        arrToVerify,
        { sys_id: values[j] },
        "sys_id"
      );

      if (operation === "=" && !contain) return false;
      else if (operation === "IN" && contain) return true;
    }

    // when it reaches this statement depend on operation type:
    // `=` means there was no field that does NOT have the required condition values
    // `IN` means there was no field that HAVE the required condition values
    return operation === "=";
  },

  /**
   * get output object based on configured columns of the reservable. `sys_id` and `name` must always be presented.
   * @param {GlideRecord} reservableGr
   * @param {string} reservableType - location or configuration_time. Each of the type will have extra properties accordingly
   * @param {string[]} reservableColumns - output reservable table columns
   * @param {boolean} requireApproval - indicate whether the reservable requires an approval flow
   * @param {boolean} [includeStandardServices] - include standard services if applicable
   * @param {boolean} [includeReservablePurposes] - include reservable purposes if applicable
   * @return {ReservableUnit} reservable object with properties based on the configuration
   */
  getReservableOutput: function (
    reservableGr,
    reservableType,
    reservableColumns,
    requireApproval,
    includeStandardServices,
    includeReservablePurposes
  ) {
    // make sure the reservable columns always contain the 2 required fields.
    if (reservableColumns.indexOf("sys_id") < 0)
      reservableColumns.push("sys_id");

    if (reservableColumns.indexOf("name") < 0) reservableColumns.push("name");

    var reservableUnit = this.recordUtils.getObjectFromGlideRecord(
      reservableGr,
      reservableColumns
    );
    reservableUnit.require_approval = WSDUtils.safeBool(requireApproval);
    reservableUnit.location_type = this.recordUtils.getReferenceObject(
      reservableGr,
      "location_type"
    );

    // handle output for location type
    if (reservableType === WSDConstants.RESERVABLE_TYPE.location) {
      reservableUnit.image = this.recordUtils.getImageFromField(
        reservableGr,
        "image"
      );

      var cachedLocDetails;
      // fetch standard services for location
      if (includeStandardServices) {
        //Check if standardServices of the reservableGr are cached.
        cachedLocDetails = this.cacheUtils.get(reservableGr.getValue("sys_id"));
        var standardServices = cachedLocDetails
          ? cachedLocDetails.standardServices
          : null;
        if (standardServices)
          reservableUnit.standard_services = standardServices;
        else {
          /*If cache miss, then get the standard services available for the reservable.
					  Cache miss can happen when enable filter is off and view is not map view*/
          reservableUnit.standard_services = this.standardServiceHelper.getLocStandardServiceById(
            reservableGr.getValue("sys_id")
          );
        }
      }

      // fetch reservable purposes for location
      if (includeReservablePurposes) {
        //Check if reservablePurposes of the reservableGr are cached.
        cachedLocDetails = cachedLocDetails
          ? cachedLocDetails
          : this.cacheUtils.get(reservableGr.getValue("sys_id"));
        var reservablePurposes = cachedLocDetails
          ? cachedLocDetails.reservablePurposes
          : null;
        if (reservablePurposes)
          reservableUnit.reservable_purposes = reservablePurposes;
        else {
          /*If cache miss, then get the reservable puposes available for the reservable.
					  Cache miss can happen when enable filter is off and view is not map view*/
          reservableUnit.reservable_purposes = this.reservablePurposeService.getLocReservablePurposeById(
            reservableGr.getValue("sys_id")
          );
        }
      }
    }

    return reservableUnit;
  },

  /**
   * Saves the last searched reservable module, building, floor, time slot, shift and sort by to the user's preferences
   * The saved search will be used the next time the user searches
   * @param {Object} searchRequest
   */
  saveSearch: function (searchRequest) {
    var saveSearchBody = this._constructSaveSearchBody(searchRequest);
    gs.getUser().savePreference(
      WSDConstants.USER_PREFERENCE.lastSearchRequest,
      JSON.stringify(saveSearchBody)
    );
  },

  /**
   * Construct an object containg a smaller sub set of the original search request
   * Data will be used to store user's search request
   * @param {Object} searchRequest
   * @returns {Object}
   * @private
   */
  _constructSaveSearchBody: function (searchRequest) {
    var fields = ["reservable_module", "shift", "time_slot", "sort_by"];
    var body = fields.reduce(function (acc, current) {
      acc[current] = searchRequest[current];
      return acc;
    }, {});

    body.building = this.getBuildingFromSearchQuery(
      searchRequest.searchCriteria
    );
    body.floors = this.getFloorIdsFromSearchQuery(searchRequest.searchCriteria);

    return body;
  },

  /**
   * Searches the search query for a building sysid
   * @param {string} searchQuery
   * @return {string|null}
   */
  getBuildingFromSearchQuery: function (searchQuery) {
    if (searchQuery && typeof searchQuery === "string") {
      var buildingRegex = /(\^|\^OR|\^NQ|^)building\=([0-9a-f]{32})(\^|$)/i;
      var buildingMatches = searchQuery.match(buildingRegex);
      if (buildingMatches) return buildingMatches[2];
    }

    return null;
  },

  /**
   * Searches the search query for floor sys ids
   * @param {string} searchQuery
   * @return {string|null}
   */
  getFloorIdsFromSearchQuery: function (searchQuery) {
    if (searchQuery && typeof searchQuery === "string") {
      var regex = /floorIN([a-zA-Z0-9,]*)/;
      var result = searchQuery.match(regex);

      if (result) return result[1];
    }

    return null;
  },

  /**
   * Returns the initial search config to show on wsd_search. If url params were resolved, then returns them, else,Either returns the previous search (via user preferences) or the users building
   * @param {string} preSelectedReservableModule - sys_id of a module that was preSelected via e.g. url parameters
   * @param {string} buildingId - sys_id of a building from url parameters
   * @param {string} shiftId - sys_id of shift from url parameters
   * @param {boolean} [loadFullReservableModule] - if true, fetch full details of reservable module including mapping, otherwise fetch as a choice
   * @param {string} [sourceWidget] - If provided will only return reservable module in InitSearchConfig if allowed in widget.
   * @returns {InitSearchConfig}
   */
  getInitSearchConfig: function (
    preSelectedReservableModule,
    preSelectedBuildingId,
    preSelectedShiftId,
    loadFullReservableModule,
    sourceWidget
  ) {
    var searchObj;
    var searchConfig = {};
    searchConfig.reservable_module = loadFullReservableModule
      ? this.reservableModuleService.getReservableModule(
          preSelectedReservableModule,
          sourceWidget
        )
      : this.reservableModuleService.getReservableModuleAsChoiceById(
          preSelectedReservableModule,
          sourceWidget
        );
    searchConfig.building = this.getBuildingFromId(preSelectedBuildingId);
    if (!searchConfig.reservable_module || !searchConfig.building) {
      var searchObjStr = gs
        .getUser()
        .getPreference(WSDConstants.USER_PREFERENCE.lastSearchRequest);
      if (!searchObjStr || searchObjStr.length === 0)
        searchObj = this.getFirstSearchConfig();
      else searchObj = JSON.parse(searchObjStr);

      // if user has supplied a pre selected module via the url, then no need to fetch the details for the module from previous search config. Remove it from the searchObj
      if (searchConfig.reservable_module) searchObj.reservable_module = null;
      searchConfig = this._resolveSearchConfigData(
        searchObj,
        loadFullReservableModule,
        sourceWidget,
        searchConfig.reservable_module
      );
    }
    if (
      preSelectedShiftId &&
      this.shiftService.validateUserAllowedShift(
        preSelectedShiftId,
        gs.getUserID()
      )
    )
      searchConfig.shift = this.shiftService.validateShiftIsAvailableTodayAndGetDetails(
        preSelectedShiftId
      );

    return searchConfig;
  },

  /**
   * Gets the display values for the searchObj
   * @param {object} searchObj
   * @param {boolean} [loadFullReservableModule] - if true, fetch full details of reservable module including mapping, otherwise fetch as a choice
   * @param {string} [sourceWidget] - If provided will only return reservable module in InitSearchConfig if allowed in source. Current options: advanced_reservation, quick_reservation.
   * @param {ReservableModule} - reservable module object
   * @returns {InitSearchConfig}
   */
  _resolveSearchConfigData: function (
    searchObj,
    loadFullReservableModule,
    sourceWidget,
    reservable_module
  ) {
    if (!searchObj) return {};

    var savedSearch = {};
    if (searchObj.building)
      savedSearch.building = this.getBuildingFromId(searchObj.building);

    if (searchObj.floors)
      savedSearch.floors = this.getFloorsFromIds(searchObj.floors);

    if (searchObj.reservable_module) {
      savedSearch.reservable_module = loadFullReservableModule
        ? this.reservableModuleService.getReservableModule(
            searchObj.reservable_module,
            sourceWidget
          )
        : this.reservableModuleService.getReservableModuleAsChoiceById(
            searchObj.reservable_module,
            sourceWidget
          );
    } else savedSearch.reservable_module = reservable_module;

    if (
      searchObj.shift &&
      this.shiftService.validateUserAllowedShift(
        searchObj.shift,
        gs.getUserID()
      )
    )
      savedSearch.shift = this.shiftService.validateShiftIsAvailableTodayAndGetDetails(
        searchObj.shift
      );

    if (searchObj.time_slot) {
      var timeSlotGr = this.timeSlotService.getTimeSlotGrById(
        searchObj.time_slot
      );
      savedSearch.time_slot = this.recordUtils.getObjectFromGlideRecord(
        timeSlotGr,
        ["sys_id", "name", true]
      );
    }

    if (!WSDUtils.nullOrEmpty(searchObj.sort_by))
      savedSearch.sort_by = searchObj.sort_by;

    return savedSearch;
  },

  /**
   * Gets the first search config for the user. Gets building value if users location is building
   * @returns {InitSearchConfig}
   */
  getFirstSearchConfig: function () {
    var userGr = this.recordUtils.getUserRecord(gs.getUserID());
    if (
      String(userGr.location.sys_class_name) ===
      WSDConstants.TABLES.Building.name
    )
      return {
        building: userGr.getValue("location"),
      };

    return {};
  },

  /**
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
      display_value: buildingGr.getDisplayValue(),
      parent_display_value: this._getBuidlingHierarchyName(buildingGr),
      name: buildingGr.getValue("name"), // on frontend, we use name as display
    };
  },

  /**
   * Gets the floor values of the floors provided
   * @param {string} floorIds
   * @returns {[]|null}
   */
  getFloorsFromIds: function (floorIds) {
    if (!floorIds) return null;

    var floors = [];

    var floorGr = new GlideRecord(WSDConstants.TABLES.Floor.name);
    floorGr.addQuery("sys_id", "IN", floorIds);
    floorGr.addActiveQuery();
    floorGr.query();

    while (floorGr.next()) {
      floors.push({
        sys_id: floorGr.getUniqueValue(),
        display_value: floorGr.getDisplayValue(),
      });
    }

    return floors;
  },

  /**
   * Gets the building' campus and site name in a string
   * @param {GlideRecord} buildingGr - GlideRecord of the building.
   * @returns {String}
   */
  _getBuidlingHierarchyName: function (buildingGr) {
    var parentDisplayValues = [];

    if (buildingGr.campus && buildingGr.campus.getDisplayValue())
      parentDisplayValues.push(buildingGr.campus.getDisplayValue());

    if (buildingGr.site && buildingGr.site.getDisplayValue())
      parentDisplayValues.push(buildingGr.site.getDisplayValue());

    return parentDisplayValues.join(", ");
  },

  /**
   * Applies a sort onto the reservables glide record provided.
   * @param {string} sortBy - 'a_z' to sort alphabetically ascending and 'z_a' to sort alphabetically descending
   * @param {GlideRecord} gr - GlideRecord to apply sort onto.
   * @param {string} fieldNameToSort - column to sort on
   * @private
   */
  _addSortQuery: function (sortBy, gr, fieldNameToSort) {
    fieldNameToSort = fieldNameToSort
      ? fieldNameToSort
      : this.DEFAULT_SORT_FIELD;
    if (sortBy === WSDConstants.SEARCH_SORT_BY.z_a)
      gr.orderByDesc(fieldNameToSort);
    else gr.orderBy(fieldNameToSort);
  },

  /*
   * Function to fetch field values from reservation module record to be passed as parameters for the search service
   * @param {string} moduleSysId sys_id of the reservable module
   * @return {object} fieldValue Object contains values of the columns
   */
  getQueryParametersForSearchService: function (moduleSysId) {
    var moduleGr = new GlideRecord(WSDConstants.TABLES.ReservableModule.name);
    if (moduleGr.get(moduleSysId)) {
      var fieldValue = {};
      fieldValue.reservableFilter = String(moduleGr.reservable_filter);
      fieldValue.reservableType = String(moduleGr.reservable_type);
      fieldValue.requireApproval = String(moduleGr.require_approval);
      fieldValue.reservableTable = String(moduleGr.reservable_table);
      return fieldValue;
    }
    return false;
  },

  /**
   * Function to check if Space management plugin is installed and reservable type is location
   * @param {string} reservableType - location or configuration_time. Each of the type will have extra properties accordingly
   * @return {Boolean}
   */
  _isSpaceMgmtApplicable: function (reservableType) {
    return (
      GlidePluginManager.isActive("com.sn_wsd_space_mgmt") &&
      reservableType === WSDConstants.RESERVABLE_TYPE.location
    );
  },

  /**
   * Add Assignment type and Cost Center / Department query to reservableGr
   * @param {GlideRecord} reservableGr
   * @param {ParsedCondition[]} [parsedExtraConditions] - parsed filter conditions
   * @param {boolean} [requireCostCenterDepartmentCheck] - Check to match space's Cost Center / Department with User's Cost Center / Department while search
   * @return {String}
   */
  _addSpaceMgmtQueries: function (
    reservableGr,
    parsedExtraConditions,
    requireCostCenterDepartmentCheck
  ) {
    //Assignment Type query
    reservableGr
      .addNullQuery("wsd_assignment_type")
      .addOrCondition(
        "wsd_assignment_type",
        sn_wsd_core.WPConstants.ASSIGNMENT_TYPE.FLEX
      );

    //Cost Center / Department query
    if (requireCostCenterDepartmentCheck) {
      var buildingId = this._getBuilding(parsedExtraConditions);
      var userId = gs.getUserID();
      var ccDeptQuery = new sn_wsd_spcmgmt.WPUserProfile().getCCDeptQuery(
        userId,
        buildingId
      );

      if (!gs.nil(ccDeptQuery)) reservableGr.addEncodedQuery(ccDeptQuery);
    }
  },

  /**
   * Function to extract building Id from parsedExtraConditions
   * @param {ParsedCondition[]} [parsedExtraConditions] - parsed filter conditions
   * @return {String}
   */
  _getBuilding: function (parsedExtraConditions) {
    if (!parsedExtraConditions) return null;

    var buildingId;
    for (var i = 0; i < parsedExtraConditions.length; i++) {
      if (parsedExtraConditions[i].key == "building") {
        buildingId = parsedExtraConditions[i].value;
        break;
      }
    }
    return buildingId;
  },

  type: "WSDSearchServiceSNC",
};

/**
 * @typedef ParsedCondition object represent condition that was parsed from an encoded query
 * @property {string} key - key of the condition (can be a field name or a property)
 * @property {string} value - value of the condition
 * @property {string} operation - by default supports (=, IN, CONTAINS)
 * @property {boolean} isPrimaryCondition - indicate such condition is a field/column of the original reservable table
 * @property {string} origin - the original string condition
 */

/**
 * @typedef Filter applicable filter data for a list of reservable units
 * @property {Floor[]} floors list of filterable floor
 * @property {StandardService[]} standard_services list of filterable standard services
 */

/**
 * @typedef ReservableSearchOutput
 * @property {ReservableUnit[]} reservableUnits list of reservable units
 * @property {Filter} filter applicable filter for the reservable units result
 * @property {number} nextItemIndex next item index for pagination. -1 if there is no more item available for pagination
 * @property {number} totalProcessed - total number of record has been processed for the full search (including constructing filter)
 * @property {boolean} hasMore whether there are more items
 */

/**
 * @typedef ResolvedReservablesOutput - resolved output from searched reservable glide record
 * @property {ReservableUnit[]} reservableUnits
 * @property {number} recordProcessedForResult - records searched through to find the ones we want
 * @property {number} totalProcessed - total number of record has been processed
 * @property {StandardServices[]} standardServices - constructed list of standard services available across all eligible locations.
 * @property {ReservablePurposes[]} reservablePurposes - constructed list of reservable purposes available across all eligible locations.
 * @property {Object} eligibleLocData - containing eligibleLocations and unique areas, floors and building of the eliglibleLocations.
 */

/**
 * @typedef ReservableUnit Reservable unit with additional fields from reservation module
 * @property {string} sys_id
 * @property {string} name
 * @property {WSDImage} image
 * @property {StandardService[]} standard_services
 * @property {ReservablePurpose[]} reservable_purposes
 * @property {boolean} [is_available] only available through method WSDSearchServiceSNC.searchForReservableUnits
 * @property {Reservations} [reservations] only available through method WSDSearchServiceSNC.searchForReservableUnits
 */

/**
 * @typedef {Object} StandardService Object containg standard services data
 * @property {string} sys_id - sys_id of the standard service
 * @property {string} name - name of the standard service
 * @property {string} short_description - short description of the standard service
 * @property {string} font_awesome_icon - icon that will be used to indicate what service it is
 */

/**
 * @typedef ReservablePurpose Object containg reservable purposes data
 * @property {string} sys_id - sys_id of the reservable purpose
 * @property {string} name - name of the reservable purpose
 * @property {string} short_description - short description of the reservable purpose
 */

/**
 * @typedef InitSearchConfig Initial search config shown when the user opens wsd_search
 * @property {object} [reservable_module] sys_id and display_value of the reservable module
 * @property {object} [building] sys_id and display_value of the reservable module
 */

/**
 * @typedef ReservableContainer container details for each reservable
 * @property {string} sys_id
 * @property {string} name
 * @property {string} display_value
 */

/**
 * Method to modify the reservable item before sending it back
 * @callback ReservableUnitCallback
 * @param {GlideRecord} reservableGr
 * @param {ReservableUnit} reservableUnit - object returned which you can make modifications to
 */

/**
 * @typedef AlternateSearchOptions
 * @property {string} reservable_filter
 */
