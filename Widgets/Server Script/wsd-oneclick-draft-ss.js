(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */

  /**
   * get building id of logged in user from workplace profile
   * if user is assigned an area / zone
   * or if user is assigned a direct space
   * return the building sys id
   * <-- CHANGE OF PLAN -->
   * keep the reservable module (for now) within workplace profile table
   * via a new field
   */
  if (input && input.action && input.action == "getBuildingModule") {
    data.building_module_details = _getReservableModuleAndBuilding();
    data.search_object_template = JSON.parse(
      gs.getProperty("sn_wsd_rsv.one_click.search.object.template")
    );
    data.current_date_utc = _getCurrentDateTimeObjectUtc();
  }

  /**
   *
   */
  function _getCurrentDateTimeObjectUtc() {
    //
    var tmpObj = {};
    tmpObj.start = _getDateTimeUTC();
    tmpObj.end = _getDateTimeUTC(8);
    return tmpObj;
  }

  /**
   * returns current time in moment format
   * if duration passed then adds to current time
   * @param {integer} duration hours
   *
   */
  function _getDateTimeUTC(duration) {
    //
    if (!duration) {
      return new GlideDateTime().getValue().replace(" ", "T").concat("Z");
    } else {
      var gdt = new GlideDateTime();
      gdt.addSeconds(duration * 3600);
      return gdt.getValue().replace(" ", "T").concat("Z");
    }
  }

  /**
   *
   * @returns {Object}
   */
  function _getReservableModuleAndBuilding() {
    var tmpObj = {};
    var profile = new GlideRecord("sn_wsd_core_workplace_profile");
    if (profile.get("employee", gs.getUserID())) {
      if (
        profile.workplace_location.sys_class_name == "sn_wsd_core_area" ||
        profile.workplace_location.sys_class_name == "sn_wsd_core_space"
      ) {
        tmpObj.status = "valid_profile";
        tmpObj.user_building_id =
          profile.workplace_location.building.sys_id + "";
        tmpObj.user_building_label =
          profile.workplace_location.building.getDisplayValue() + "";
        tmpObj.user_reserve_module = profile.u_reservable_module + "";
        tmpObj.user_area_id = profile.workplace_location.sys_id + "";
      } else {
        tmpObj.status = "invalid_profile";
        tmpObj.user_building_id = "";
        tmpObj.user_reserve_module = "";
      }
    } else {
      tmpObj.status = "invalid_user";
    }
    return tmpObj;
    // var searchService = new WSDSearchService();
    // var buildingModuleDetails =
    //   searchService.getReservableModuleAndBuilding(buildingID);
    // console.log("RC build details " + buildingModuleDetails);
  }
})();
