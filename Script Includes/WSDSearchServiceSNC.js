// custom type definitions can be found at the bottom of the file.

var WSDSearchServiceSNC = Class.create();
WSDSearchServiceSNC.prototype = {
  DEFAULT_PAGE_SIZE: 8,
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

  initialize: function () {
    this.availabilityService = new WSDAvailabilityService();
    this.recordUtils = new WSDRecordUtils();
    this.standardServiceHelper = new WSDStandardServicesHelper();
    this.reservablePurposeService = new WSDReservablePurposesService();
    this.reservableModuleService = new WSDReservableModuleService();
    this.shiftService = new WSDShiftService();
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

    return this.searchForReservableUnits(
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
  },

  /**
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

    reservableGr.query();

    WSDLogger.debug(
      "WSDSearchServiceSNC.searchForReservableUnits",
      "Constructed (primary) query on search",
      { table: reservableTable, encodedQuery: reservableGr.getEncodedQuery() }
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
   * @return {number}
   */
  getSearchLimit: function () {
    var searchLimit = WSDUtils.getIntProperty(
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
  _resolveAndConstructFilterData: function (reservableType, reservableUnits) {
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
        !WSDUtils.arrayContainsElement(
          filter.floors,
          reservableUnit.floor,
          "sys_id"
        )
      )
        filter.floors.push(reservableUnit.floor);

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

      // fetch standard services for location
      if (includeStandardServices)
        reservableUnit.standard_services =
          this.standardServiceHelper.getLocStandardServiceById(
            reservableGr.getValue("sys_id")
          );

      // fetch reservable purposes for location
      if (includeReservablePurposes)
        reservableUnit.reservable_purposes =
          this.reservablePurposeService.getLocReservablePurposeById(
            reservableGr.getValue("sys_id")
          );
    }

    return reservableUnit;
  },

  /**
   * Saves the last searched reservable module and building to the users preferences for using when starting wsd_search in the future
   * @param {string} reservable_module
   * @param {string} [searchQuery]
   */
  saveSearch: function (reservableModule, shift, searchQuery, sortBy) {
    var buildingId = this.getBuildingFromSearchQuery(searchQuery);
    var floorIds = this.getFloorIdsFromSearchQuery(searchQuery);

    var searchObj = {
      reservable_module: reservableModule,
      shift: shift,
      building: buildingId,
      floors: floorIds,
      sortBy: sortBy,
    };

    var searchObjStr = JSON.stringify(searchObj);
    gs.getUser().savePreference(
      WSDConstants.USER_PREFERENCE.lastSearchRequest,
      searchObjStr
    );
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
   * Returns the initial search config to show on wsd_search. Either returns the previous search (via user preferences) or the users building
   * @param preSelectedReservableModule sys_id of a module that was preSelected via e.g. url parameters
   * @returns {InitSearchConfig}
   */
  getInitSearchConfig: function (preSelectedReservableModule) {
    var searchObj;
    var searchObjStr = gs
      .getUser()
      .getPreference(WSDConstants.USER_PREFERENCE.lastSearchRequest);
    if (!searchObjStr || searchObjStr.length === 0)
      searchObj = this.getFirstSearchConfig();
    else searchObj = JSON.parse(searchObjStr);

    // if user has supplied a pre selected module via the url, overwrite this.
    if (preSelectedReservableModule) {
      searchObj.reservable_module = preSelectedReservableModule;
    }

    return this._resolveSearchConfigData(searchObj);
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

    if (!WSDUtils.nullOrEmpty(searchObj.sortBy))
      searchObjWithDisplay.sortBy = searchObj.sortBy;

    return searchObjWithDisplay;
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
