api.controller = function ($sce, $location, spModal, $uibModal, $scope) {
  var c = this;

  c.mobileScreen = false;

  c.isLoading = false;
  c.trustSrc = trustSrc;
  c.office = c.office || {};
  c.locationError = c.data.locationError || "";

  if (screen.width < 768) c.mobileScreen = true;

  c.data.hasSeperator = true;

  if ($location.url().indexOf("tab=") != -1) {
    if ($location.url().indexOf("tab=home") != -1) c.data.hasSeperator = true;
    else c.data.hasSeperator = false;
  }

  // RC - STRY2435835
  c.captureJourneyLink = function (sys_id, table, notes) {
    c.server
      .get({
        action: "capture_journey",
        defSysId: "fcc92138db4cd85020df6e25ca961983", //journey def : COVID_MicroSite_Link Click
        sys_id: "ff431c161bc12cd00a1a62c6624bcb10", //self widget sys id
        table: table,
        notes: notes,
      })
      .then(function (r) {});
  };

  c.$onInit = function () {
    if (c.data.isRemote) {
      getPosition()
        .then(function (position) {
          c.isLoading = false;

          var targetLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          findLocation(targetLocation);
        })
        .catch(function (error) {
          var permissionMsg =
            "Please enable your browser location service to find an office nearby; refresh browser afterwards. ";
          var otherMsg = "Unable to retrieve user location. ";
          c.isLoading = false;
          findLocation("defaultLocation");
          c.locationError =
            error.code === 1
              ? permissionMsg + error.message
              : otherMsg + error.message;
        });
    } else {
      c.office = c.data.assignedLocation;
    }
  };

  c.showdetails = function (table, reservation) {
    spModal.open({
      message: "Reservation Detail is loading...",
      button: ["", ""],
      footerStyle: { display: "none" },
      headerStyle: { display: "none" },
      contentFullWidth: true,
      backdrop: "static",
    });

    spModal.open({
      widgetInput: { sys_id: reservation, table: table },
      widget: "covid_show_reservation_details",
      button: ["", ""],
      footerStyle: { display: "none" },
      headerStyle: { display: "none" },
      contentFullWidth: true,
      backdrop: "static",
    });
    /*	c.modalInstance = $uibModal.open({
 templateUrl: 'modalTemplate',
 scope: $scope
 });*/
  };

  function findLocation(targetLocation) {
    c.server
      .get({
        action: "findLocation",
        target: targetLocation,
      })
      .then(function (response) {
        c.office = response.data.nearbyLocation;
      });
  }

  function trustSrc(src) {
    return $sce.trustAsResourceUrl(src);
  }

  function getPosition(options) {
    c.isLoading = true;
    return new Promise(function (resolve, reject) {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  c.$onInit();
};
