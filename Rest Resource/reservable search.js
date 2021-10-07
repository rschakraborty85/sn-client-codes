/**
 * Universal reservable search endpoint. Search for reservable items using reservable module configuration.
 * @method GET
 * @resourcePath /api/sn_wsd_rsv/search/reservable - example: /api/sn_wsd_rsv/search/reservable?q=active=true&start=2021-05-12T14:30:00Z&end=2021-05-12T16:30:00Z&include_unavailable_items=true&include_reservations_within_days=true
 */
 (function process( /*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
	var RESOURCE_PATH = '/api/sn_wsd_rsv/search/reservable';
	var apiHelper = new WSDApiHelper();
	var searchService = new WSDSearchService();
	var reservableModuleService = new WSDReservableModuleService();
	var restValidator = new WSDRestRequestValidator();
	var shiftValidator = new WSDShiftValidator();
	var shiftService = new WSDShiftService();

	//STRY2456995:Workspace Search Changes - Workplace Reservation Management
	// searchCriteria is expected to be encodedQuery
	var requestObj = {
		searchCriteria: String(request.queryParams.q),
		start: String(request.queryParams.start),
		end: String(request.queryParams.end),
		shift: String(request.queryParams.shift),
		reservable_module: String(request.queryParams.reservable_module),
		reservation_ids: String(request.queryParams.reservation_ids),
		reserved_reservables: String(request.queryParams.reserved_reservables),
		include_unavailable_items: WSDUtils.safeBool(request.queryParams.include_unavailable_items),
		include_reservations_within_days: WSDUtils.safeBool(request.queryParams.include_reservations_within_days),
		include_standard_services: WSDUtils.safeBool(request.queryParams.include_standard_services),
		include_reservable_purposes: WSDUtils.safeBool(request.queryParams.include_reservable_purposes),
		next_item_index: Number(request.queryParams.next_item_index),
		page_size: Number(request.queryParams.page_size),
		sort_by: String(request.queryParams.sort_by),
		is_load:WSDUtils.safeBool(request.queryParams.is_load)
	};

	/*
	gs.info('@@6 request sripted rest');
	gs.info('@@6 request scripted rest 2 : ' + JSON.stringify(request.queryParams));
	gs.info('@@6 request scripted rest 3 : ' + JSON.stringify(requestObj));
	*/
	
	// If the sort by string ends with :ignore, we'll save the sort option in the user preferences,
	// but ignore it in the call to searchService.search below
	var ignoreSortIndex = requestObj.sort_by.indexOf(':ignore');
	var ignoreSort = ignoreSortIndex >= 0;
	requestObj.sort_by = ignoreSort ? requestObj.sort_by.substr(0, ignoreSortIndex) : requestObj.sort_by;

	try {
		var alternateSearchOptions = {};
		// load reservable module
		var reservableModule = reservableModuleService.getReservableModule(requestObj.reservable_module);
		if (!reservableModule) {
			apiHelper.setResponse(response, 500, RESOURCE_PATH, gs.getMessage('Reservable module is empty or does not exist'), requestObj.reservable_module, requestObj);
			return;
		}

		// determine if module has shift enabled
		var moduleIsTypeShift = WSDUtils.safeBool(reservableModule.apply_to_shift);

		// validate required fields and format
		var validationResult = restValidator.validateSearchReservableRequest(requestObj, moduleIsTypeShift);
		if (!validationResult.valid) {
			apiHelper.setBadRequestResponse(response, RESOURCE_PATH, gs.getMessage('The search request data is invalid, or the required fields are missing. Please try again'), validationResult.msg, requestObj);
			return;
		}

		// validate actual search request data against the system, and return proper search request (correct time format etc...)
		var resolverResult = restValidator.validateAndResolveSearchRequest(requestObj, moduleIsTypeShift);
		if (!resolverResult.valid) {
			apiHelper.setBadRequestResponse(response, RESOURCE_PATH, gs.getMessage('The search request data is invalid. {0}', resolverResult.user_msg), null, requestObj);
			return;
		}

		var searchRequest = resolverResult.searchRequest;

		if (moduleIsTypeShift) {
			var shiftValidatorOutcome = shiftValidator.validateShiftAndStartEnd(searchRequest.shift, searchRequest.startGdt);
			if (!shiftValidatorOutcome.valid) {
				var shiftInvalidErrorMsg = shiftValidatorOutcome.user_msg ? shiftValidatorOutcome.user_msg : gs.getMessage('The search request data is invalid. Please try again');
				apiHelper.setBadRequestResponse(response, RESOURCE_PATH, shiftInvalidErrorMsg, null, requestObj);
				return;
			}

			var shiftValidatorPayload = shiftValidatorOutcome.payload;
			searchRequest.startGdt = shiftValidatorPayload.startGdt;
			searchRequest.endGdt = shiftValidatorPayload.endGdt;
			searchRequest.shiftGr = shiftValidatorPayload.shiftGr;
			alternateSearchOptions.reservable_filter = shiftService.generateEncodedQueryForLocationsOfShift(searchRequest.shift)
		}

		searchService.saveSearch(searchRequest.reservable_module, searchRequest.shift, searchRequest.searchCriteria, searchRequest.sort_by);
		searchRequest.sort_by = ignoreSort ? null : searchRequest.sort_by;

		return searchService.search(searchRequest, reservableModule, alternateSearchOptions);
	} catch (ex) {
		apiHelper.setResponse(response, 500, RESOURCE_PATH, gs.getMessage('Exception occurred! Unable to search'), ex, {requestObj: requestObj, stack: ex.stack});
	}

})(request, response);