(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */

  /**
   * get building id of logged in user from workplace profile
   * if user is assigned an area / zone
   * or if user is assigned a direct space
   * return the building sys id
   */
  if (input && input.action && input.action == "getBuildingID") {
    var profile = new GlideRecord("sn_wsd_core_workplace_profile");
    if (profile.get("employee", gs.getUserID())) {
      if (profile.workplace_location.sys_class_name == "sn_wsd_core_area") {
        data.user_building_id = profile.workplace_location.building.sys_id + "";
      }
    }
  }
})();
