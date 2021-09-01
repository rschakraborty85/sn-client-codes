var WSDSuggestedModelService = Class.create();
WSDSuggestedModelService.prototype = {
  initialize: function () {},

  getSeatDetails: function (request, response, building) {
    try {
      var mostBookedSeat = this.getMostBookedSeat(gs.getUserID()) + "";
      var lastBookedSeat = this.getLastBookedSeat(gs.getUserID()) + "";
      var getUsedSeats = this._getAlreadySuggestedSeat() + "";
      var searchStringDefault = String(request.queryParams.q);
      var favSeats = [];
      favSeats.push(mostBookedSeat);
      favSeats.push(lastBookedSeat);
      if (favSeats.length != 0)
        searchString = searchStringDefault + "^sys_idIN" + favSeats;
      // building query needs to be added
      else searchString = searchStringDefault;
      //     "building=7d3bafaedb2614500adbc4be139619b0^active=true^sys_class_name=sn_wsd_core_space"; // this can never be null // UI will add building query as default
      // gs.info("callReservableAPI == searchString" + searchString);

      var result = this.callReservableAPI(request, response, searchString);
      // gs.info("RC is it working " + JSON.stringify(result));
      var favSeatDetails = this.getFirstSpace(result);
      if (
        favSeatDetails != null &&
        favSeatDetails != undefined &&
        favSeatDetails != ""
      ) {
        this._storeSuggestedSpace(favSeatDetails);
        return favSeatDetails;
      } else {
        var tmpStore = this.getFirstSpace(
          this.callReservableAPI(request, response, searchStringDefault)
        );
        this._storeSuggestedSpace(tmpStore);
        return tmpStore;
      }
    } catch (ex) {
      gs.error("getSeatDetails Exception==" + ex);
    }
  },

  _getAlreadySuggestedSeat: function () {
    //u_location.ref_sn_wsd_core_area.building.sys_id=
    var tracker = new GlideRecord("sn_wsd_rsv_suggested_space_tracker");
    tracker.addQuery("u_location.ref_sn_wsd_core_area.building.sys_id",)
  },
  /**
   *
   * @param {Object} seatDetailsObject
   * @returns {void}
   */
  _storeSuggestedSpace: function (seatDetailsObject) {
    // gs.info("RC _storeSuggestedSpace " + JSON.stringify(seatDetailsObject));
    // var parsedSeatDetails = JSON.parse(seatDetailsObject)
    var shrt = seatDetailsObject;
    var tracker = new GlideRecord("sn_wsd_rsv_suggested_space_tracker");
    tracker.initialize();
    tracker.u_location = shrt.sys_id + "";
    tracker.u_user = gs.getUserID() + "";
    tracker.u_status = "suggested";
    tracker.insert();
    return;
  },

  getMostBookedSeat: function (user) {
    var ga = new GlideAggregate("sn_wsd_rsv_reservation");
    ga.addQuery("requested_for", user);
    ga.addAggregate("COUNT", "location");
    ga.orderByAggregate("COUNT", "location");
    ga.query();
    var i = 0;
    var space = "";
    while (ga.next() && i++ < 1) {
      space = ga.getValue("location").toString();
    }
    //gs.info("getMostBookedSeats==" + space);
    return space;
  },

  getLastBookedSeat: function (user) {
    var gr = new GlideRecord("sn_wsd_rsv_reservation");
    gr.addEncodedQuery("requested_for=" + user); //Check any filters on state to be kept for finding last reserved space
    gr.orderByDesc("sys_updated_on");
    gr.query();
    var space = "";
    if (gr.next()) {
      //gs.info("getLastBookedSeat==" + gr.getValue("location"));
      space = gr.getValue("location").toString();
    }
    return space;
  },

  getFirstSpace: function (result) {
    var reservableUnits = "";
    var parser = new global.JSONParser();
    var parsed = parser.parse(global.JSON.stringify(result));
    reservableUnits = parsed.reservableUnits[0];
    gs.info(
      "RC Scripted Rest API getFirstSpace function Result reservableUnits === " +
        reservableUnits
    );
    if (
      reservableUnits != "" &&
      reservableUnits != undefined &&
      reservableUnits != null
    )
      return reservableUnits;
    return "";
  },

  getTodayReservationDetails: function () {
    try {
      var resvDetails = "";
      var reservationGr = new GlideRecord("sn_wsd_rsv_reservation");
      reservationGr.addEncodedQuery(
        "active=true^startONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()^requested_for=" +
          gs.getUserID()
      );
      reservationGr.query();
      if (reservationGr.next()) {
        resvDetails = {
          todaysreservation: {
            sys_id: reservationGr.location.toString(),
            external_id: reservationGr.location.external_id.toString(),
            todays_status: reservationGr.state.toString(),
          },
        };
      }
      return global.JSON.stringify(resvDetails);
    } catch (ex) {
      gs.error("getTodayReservationDetailsCatch===" + ex);
    }
  },

  callReservableAPI: function (request, response, searchString) {
    var RESOURCE_PATH = "/api/sn_wsd_rsv/search/suggested_seat";
    var apiHelper = new WSDApiHelper();
    var searchService = new WSDSearchService();
    var reservableModuleService = new WSDReservableModuleService();
    var restValidator = new WSDRestRequestValidator();
    var shiftValidator = new WSDShiftValidator();
    var shiftService = new WSDShiftService();

    // searchCriteria is expected to be encodedQuery
    var requestObj = {
      searchCriteria: searchString,
      start: String(request.queryParams.start),
      end: String(request.queryParams.end),
      shift: String(request.queryParams.shift),
      reservable_module: String(request.queryParams.reservable_module),
      reservation_ids: String(request.queryParams.reservation_ids),
      reserved_reservables: String(request.queryParams.reserved_reservables),
      include_unavailable_items: WSDUtils.safeBool(
        request.queryParams.include_unavailable_items
      ),
      include_reservations_within_days: WSDUtils.safeBool(
        request.queryParams.include_reservations_within_days
      ),
      include_standard_services: WSDUtils.safeBool(
        request.queryParams.include_standard_services
      ),
      include_reservable_purposes: WSDUtils.safeBool(
        request.queryParams.include_reservable_purposes
      ),
      next_item_index: Number(request.queryParams.next_item_index),
      page_size: Number(request.queryParams.page_size),
      sort_by: String(request.queryParams.sort_by),
    };

    // If the sort by string ends with :ignore, we'll save the sort option in the user preferences,
    // but ignore it in the call to searchService.search below
    var ignoreSortIndex = requestObj.sort_by.indexOf(":ignore");
    var ignoreSort = ignoreSortIndex >= 0;
    requestObj.sort_by = ignoreSort
      ? requestObj.sort_by.substr(0, ignoreSortIndex)
      : requestObj.sort_by;

    try {
      var alternateSearchOptions = {};
      // load reservable module
      var reservableModule = reservableModuleService.getReservableModule(
        requestObj.reservable_module
      );
      if (!reservableModule) {
        apiHelper.setResponse(
          response,
          500,
          RESOURCE_PATH,
          gs.getMessage("Reservable module is empty or does not exist"),
          requestObj.reservable_module,
          requestObj
        );
        return;
      }

      // determine if module has shift enabled
      var moduleIsTypeShift = WSDUtils.safeBool(
        reservableModule.apply_to_shift
      );

      // validate required fields and format
      var validationResult = restValidator.validateSearchReservableRequest(
        requestObj,
        moduleIsTypeShift
      );
      if (!validationResult.valid) {
        apiHelper.setBadRequestResponse(
          response,
          RESOURCE_PATH,
          gs.getMessage(
            "The search request data is invalid, or the required fields are missing. Please try again"
          ),
          validationResult.msg,
          requestObj
        );
        return;
      }

      // validate actual search request data against the system, and return proper search request (correct time format etc...)
      var resolverResult = restValidator.validateAndResolveSearchRequest(
        requestObj,
        moduleIsTypeShift
      );
      if (!resolverResult.valid) {
        apiHelper.setBadRequestResponse(
          response,
          RESOURCE_PATH,
          gs.getMessage(
            "The search request data is invalid. {0}",
            resolverResult.user_msg
          ),
          null,
          requestObj
        );
        return;
      }

      var searchRequest = resolverResult.searchRequest;
      // gs.info("RC searchRequest " + JSON.stringify(searchRequest));

      if (moduleIsTypeShift) {
        var shiftValidatorOutcome = shiftValidator.validateShiftAndStartEnd(
          searchRequest.shift,
          searchRequest.startGdt
        );
        if (!shiftValidatorOutcome.valid) {
          var shiftInvalidErrorMsg = shiftValidatorOutcome.user_msg
            ? shiftValidatorOutcome.user_msg
            : gs.getMessage(
                "The search request data is invalid. Please try again"
              );
          apiHelper.setBadRequestResponse(
            response,
            RESOURCE_PATH,
            shiftInvalidErrorMsg,
            null,
            requestObj
          );
          return;
        }

        var shiftValidatorPayload = shiftValidatorOutcome.payload;
        searchRequest.startGdt = shiftValidatorPayload.startGdt;
        searchRequest.endGdt = shiftValidatorPayload.endGdt;
        searchRequest.shiftGr = shiftValidatorPayload.shiftGr;
        alternateSearchOptions.reservable_filter =
          shiftService.generateEncodedQueryForLocationsOfShift(
            searchRequest.shift
          );
      }
      searchService.saveSearch(
        searchRequest.reservable_module,
        searchRequest.shift,
        searchRequest.searchCriteria,
        searchRequest.sort_by
      );
      searchRequest.sort_by = ignoreSort ? null : searchRequest.sort_by;
      return searchService.search(
        searchRequest,
        reservableModule,
        alternateSearchOptions
      );
    } catch (ex) {
      apiHelper.setResponse(
        response,
        500,
        RESOURCE_PATH,
        gs.getMessage("Exception occurred! Unable to search"),
        ex,
        {
          requestObj: requestObj,
          stack: ex.stack,
        }
      );
    }
  },

  type: "WSDSuggestedModelService",
};
