api.controller = function (wsdUtils, wsdReservableSearch, $window) {
  /* widget controller */
  var c = this;
  var searchObj = {}; //today
  var searchObj2 = {}; //tomorrow
  c.result = {};
  c.reservation_status = false;
  c.reservation_status_text = "Pending";
  c.widget_label_phase3 = "Steps to return to the workplace";
  c.widget_label_phase4 = "My Reservations";
  c.widget_label_phase = ["phase_1", "phase_2", "phase_3"];
  c.widget_header = c.widget_label_phase4;
  //
  _init();
  /**
   * redirect to oob page with required param
   */
  c.redirectToReservation = function (flag) {
    //
    // console.log("RC link to reservation " + flag);

    if (flag == "today") {
      $window.location.href =
        "/ws?id=wsd_reservation&reservable_ids=" +
        c.result.seat_space_sys_id +
        "&start=" +
        searchObj.start +
        "&end=" +
        searchObj.end +
        "&reservable_module=" +
        searchObj.reservable_module;
    } else if (flag == "tomorrow") {
      $window.location.href =
        "/ws?id=wsd_reservation&reservable_ids=" +
        c.result2.seat_space_sys_id +
        "&start=" +
        searchObj2.start +
        "&end=" +
        searchObj2.end +
        "&reservable_module=" +
        searchObj.reservable_module;
    }
  };
  /**
   *
   */
  function _init() {
    //
    c.server.get({ action: "getBuildingModule" }).then(function (response) {
      c.valid_profile =
        response.data.building_module_details.status == "valid_profile"
          ? true
          : false;
      console.log("RC valid profile ? " + c.valid_profile);
      if (c.valid_profile) {
        var phase = response.data.building_module_details.building_phase + "";
        // console.log("RC phase is " + phase);
        if (c.widget_label_phase.indexOf(phase) > -1)
          c.widget_header = c.widget_label_phase3;
        _getSuggestedSeat(response.data);
      }
    });
  }
  /**
   *
   * @param {Object} resp
   */
  function _getSuggestedSeat(resp) {
    //
    _callSuggestedSeatAPI(_buildSearchObject(resp));
    //console.log("RC after parse " + JSON.stringify(test));
  }

  /**
   *
   * @param {*} searchRequest
   */
  function _callSuggestedSeatAPI(searchRequest) {
    //
    //console.log("RC - before calling api " + JSON.stringify(searchRequest));
    wsdReservableSearch
      .getSuggestedSeat(searchRequest)
      .then(function (response) {
        console.log("RC lets see what we get1 " + JSON.stringify(response));
        // var tmpResponse = JSON.parse(response);
        var respToday = response.today;
        var respTomorrow = response.tomorrow;
        // console.log("RC lets see what we get1 " + JSON.stringify(respToday));

        // this is for today
        c.result = _parseResponse(respToday, "today");
        if (c.result.error) {
          c.result = _callErrorHandler(respToday);
        }
        // this is for tomorrow
        c.result2 = _parseResponse(respTomorrow, "tomorrow");
        if (c.result2.error) {
          c.result2 = _callErrorHandler(respTomorrow);
        }
        // return c.result;
        //return c.result;
        return;
      });
  }

  function _callErrorHandler(response) {
    //
    var result = {};
    result.error = true;
    result.error_msg = response.error_msg;
    result.seat_building_label = searchObj.wsd_building_label + "";
    result.seat_floor_label = searchObj.wsd_floor_label + "";
    result.seat_space_label = "";
    result.seat_space_sys_id = "";
    return result;
  }

  /**
   * to parse rest api call response
   * @param {*} response
   */
  function _parseResponse(response, when) {
    console.log("RC - parse response from api " + JSON.stringify(response));
    if (response.error) {
      return response;
    }
    var tmpObj = response; //JSON.parse(response);
    var result = {};
    result.seat_building_label = tmpObj.building.display_value + "";
    result.seat_floor_label = tmpObj.floor.display_value + "";
    result.seat_space_label = tmpObj.name + "";
    result.seat_space_sys_id = tmpObj.sys_id + "";
    if (when == "today")
      c.reservation_status = tmpObj.oc_reservation_status
        ? tmpObj.oc_reservation_status.exist
        : false;
    c.reservation_status_text = c.reservation_status ? "Completed" : "Pending";
    return result;
  }

  /**
   * @param {Promise} resp
   */
  function _buildSearchObject(resp) {
    //
    // console.log("RC building search object " + JSON.stringify(resp));
    searchObj = resp.search_object_template;
    searchObj.start = resp.current_date_utc.start;
    searchObj.end = resp.current_date_utc.end;
    searchObj.building = resp.building_module_details.user_building_id;
    searchObj.reservable_module =
      resp.building_module_details.user_reserve_module;
    searchObj.wsd_floor_label = resp.building_module_details.user_floor_label;
    searchObj.wsd_building_label =
      resp.building_module_details.user_building_label;
    searchObj.q = "active=true^active=true^sys_class_name=sn_wsd_core_space";
    //searchObj.q += "^building=" + searchObj.building;
    searchObj.q += "^area=" + resp.building_module_details.user_area_id;
    // custom search
    searchObj.wsd_area = resp.building_module_details.user_area_id;
    searchObj.wsd_start_tomorrow = resp.next_date_utc.start;
    searchObj.wsd_end_tomorrow = resp.next_date_utc.end;
    searchObj.wsd_building_phase =
      resp.building_module_details.building_phase + "";
    // keep a copy of the below data , mostly for reserve
    // button for tomorrow
    searchObj2.start = searchObj.wsd_start_tomorrow;
    searchObj2.end = searchObj.wsd_end_tomorrow;
    return searchObj;
  }

  // var start = getNearestDateTime();
  // var end = getStaticDateTime();
  // var diffMmt = getStaticDateTimeMmt().diff(getNearestDateTimeMmt(), "hours");

  /**
   *
   * @returns
   */
  function getNearestDateTime() {
    return wsdUtils.getDateTimeInUtc(
      wsdUtils.getDateTimeInFormat(wsdUtils.roundUpDateTime(moment()))
    );
  }
  function getNearestDateTimeMmt() {
    return moment(
      wsdUtils.getDateTimeInUtc(
        wsdUtils.getDateTimeInFormat(wsdUtils.roundUpDateTime(moment()))
      )
    );
  }
  /**
   *
   * @returns
   */
  function getStaticDateTime() {
    return wsdUtils.getDateTimeInUtc(
      wsdUtils.getDateTimeInFormat("2021-08-23 18:00:00")
    );
    //wsdUtils.getDateTimeInFormat(wsdUtils.roundUpDateTime(moment()))
  }
  function getStaticDateTimeMmt() {
    return moment(
      wsdUtils.getDateTimeInUtc(
        wsdUtils.getDateTimeInFormat("2021-08-23 18:00:00")
      )
    );
  }
};
