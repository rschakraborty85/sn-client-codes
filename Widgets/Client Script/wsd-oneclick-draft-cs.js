api.controller = function (wsdUtils, wsdReservableSearch) {
  /* widget controller */
  var c = this;
  //
  _init();

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
      if (c.valid_profile) {
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
  }

  /**
   *
   * @param {*} searchObj
   */
  function _callSuggestedSeatAPI(searchObj) {
    //
    // console.log("RC - before calling api " + JSON.stringify(searchObj));
    wsdReservableSearch.getSuggestedSeat(searchObj).then(function (response) {
      console.log("RC lets see what we get " + JSON.stringify(response));
    });
  }

  /**
   *
   */
  function _buildSearchObject(resp) {
    //
    // console.log(JSON.stringify(resp));
    var searchObj = resp.search_object_template;
    searchObj.start = resp.current_date_utc.start;
    searchObj.end = resp.current_date_utc.end;
    searchObj.building = resp.building_module_details.user_building_id;
    searchObj.reservable_module =
      resp.building_module_details.user_reserve_module;
    searchObj.q = "active=true^active=true^sys_class_name=sn_wsd_core_space";
    //searchObj.q += "^building=" + searchObj.building;
    searchObj.q += "^area=" + resp.building_module_details.user_area_id;
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
