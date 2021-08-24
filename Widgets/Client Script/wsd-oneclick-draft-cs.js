api.controller = function (wsdUtils) {
  /* widget controller */
  var c = this;
  //console.log("RC testing getDateTimeInFormat " + getNearestDateTime());
  var start = getNearestDateTime();
  var end = getStaticDateTime();
  var diffMmt = getStaticDateTimeMmt().diff(getNearestDateTimeMmt(), "hours");
  var buildingId = c.server
    .get({ action: "getBuildingID" })
    .then(function (response) {
      console.log("RC building  " + response.data.user_building_id);
    });
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
