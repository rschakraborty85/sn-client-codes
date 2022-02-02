(function () {
  /* populate the 'data' object */
  /* e.g., data.table = $sp.getValue('table'); */
  var MODE_TYPE = {
    search: "search",
    edit: "edit",
  };
  var DEFAULT_DAY_START = "09:00";
  var DEFAULT_DAY_END = "17:00";

  data.isMappedinInstalled = GlidePluginManager.isActive("com.sn_wsd_mappedin");
  data.showReservationDetails =
    gs.getProperty(
      "sn_wsd_core.floor_plan.portal.show_reservation_details",
      "false"
    ) == "true";

  initialize();

  /**
   * Initializes the widget server side.
   * Gets initial batch of reservations and stores in in data object.
   */
  function initialize() {
    // RC - change start
    var userUtils = new sn_wsd_rsv.WSDUserUtils();
    data.isRtoSelfReserveUser = userUtils.isLoggedInUserRtoSelfReserveUser();
    // RC - change end
    data.mode = $sp.getParameter("mode");
    data.reservable_module = $sp.getParameter("reservable_module");
    data.reservation_id = $sp.getParameter("reservation_id");
    data.reservation = _loadReservation(data.mode, data.reservation_id);

    data.initSearchConfig = new WSDSearchService().getInitSearchConfig(
      data.reservable_module
    );
    var check = JSON.stringify(data.initSearchConfig) ? "FALSE" : "TRUE";

    // RC - changed

    if (check == "TRUE") {
      data.initModuleMultiSelect =
        data.initSearchConfig &&
        data.initSearchConfig.reservable_module.allow_multi_select == "true"
          ? true
          : false;

      data.user_building_tz = data.initSearchConfig.time_zone_info;
      data.building_area_select_seat = data.initSearchConfig.building
        .area_select_seat
        ? "true"
        : "false";
      data.module_has_select_seat =
        data.initSearchConfig.reservable_module.filter_has_select_seat;
    }
    // RC - end
    options.page_size = _getDefaultPageSize();
    _fetchConfiguredStartEndDay();
  }

  /**
   * fetch day start and day end from sys property, use default value if not present
   */
  function _fetchConfiguredStartEndDay() {
    data.dayStart = gs.getProperty(
      WSDConstants.SYSTEM_PROPERTY.dayStart,
      DEFAULT_DAY_START
    );
    data.dayEnd = gs.getProperty(
      WSDConstants.SYSTEM_PROPERTY.dayEnd,
      DEFAULT_DAY_END
    );
  }

  /**
   * load reservation
   * @param {string} mode - edit or new
   * @param {string} reservationSysId - id of reservation in case it's an edit
   * @return {Reservation} editing reservation object
   */
  function _loadReservation(mode, reservationSysId) {
    if (mode !== MODE_TYPE.edit) return null;

    var reservationService = new WSDReservationService();
    var reservationResult = reservationService.getReservationById(
      reservationSysId,
      false
    );
    // console.log(
    //   "WSD Search Server ; reservationResult " +
    //     typeof reservationResult +
    //     " " +
    //     JSON.stringify(reservationResult)
    // );
    if (
      reservationResult.success &&
      reservationResult.reservationAcl.read &&
      reservationResult.reservation.edit_restriction.value ===
        WSDConstants.ROOM_RESERVATION_EDIT_RESTRICTION.noRestriction
    )
      return reservationResult.reservation;

    WSDLogger.error(
      "WSD Search Widget.getReservationById",
      "Reservation is invalid for editing mode",
      reservationSysId
    );
    return null;
  }

  /**
   * Get the default page size from either widget options, system property or fall-back value
   * @returns {number}
   * @private
   */
  function _getDefaultPageSize() {
    if (!isNaN(options.page_size) && options.page_size > 0)
      return options.page_size;

    return WSDUtils.getDefaultPageSize();
  }
})();
