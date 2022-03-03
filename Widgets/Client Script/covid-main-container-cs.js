api.controller = function (
  $location,
  $scope,
  $uibModal,
  $window,
  $sce,
  spUtil
) {
  /* widget controller */
  var c = this;

  var q = "health_and_safety_user.userDYNAMIC90d1921e5f510100a9ad2572f2b477fe";
  spUtil.recordWatch(
    $scope,
    "sn_imt_core_employee_health_and_safety_requirement",
    q,
    function (event, data) {
      spUtil.update($scope);
    }
  );

  var reservation =
    "active=true^requested_forDYNAMIC90d1921e5f510100a9ad2572f2b477fe";
  spUtil.recordWatch($scope, "sn_wsd_core_reservation", reservation, function (
    event,
    data
  ) {
    spUtil.update($scope);
  });
  var rand = Math.floor(Math.random() * 100);
  c.tabs = [
    {
      name: "Home",
      active_tab: false,
      id: "home",
      image: "emergency_health_home.svg",
    },
    {
      name: "My health & safety",
      active_tab: false,
      id: "myHealthAndSafety",
      image: "emergency_health_status.svg",
    },
    {
      // @note RC - STRY2469915
      name: "Our world of work", //Work from home
      active_tab: false,
      id: "workFromHome",
      image: "emergency_health_WFH.svg?r=" + rand,
    },
    {
      // RC , new tab added
      name: "Return to workplace",
      active_tab: false,
      id: "returnToWorkplace",
      image: "rtw.svg",
    },
    {
      // RC , renamed tab from our offices
      name: "Workplace safety",
      active_tab: false,
      id: "ourOffices",
      image: "emergency_health_our_offices.svg",
    },
    {
      // RC , new tab for India Assistance
      name: "India Employee Resources",
      active_tab: false,
      id: "idcAssistance",
      image: "emergency_health_idcAssist.svg",
    },
  ];
  c.orVal = "OR";
  c.showLoading = false;
  c.currTab = "home";
  var loc = $location.search();
  if (loc.tab) {
    if (loc.spa && loc.tab !== c.currTab) {
      var new_tab = c.tabs.find(function (tab) {
        return tab.id == loc.tab;
      });
      if (new_tab) c.currTab = loc.tab;

      c.tabs.forEach(function (tab) {
        tab.active_tab = tab.id == c.currTab;
      });
    }
  }

  if (loc.tab && loc.tab == "myHealthAndSafety") {
    if (loc.sys_id) {
      c.selfReservation = "NewReservation";
    }
    if (loc.showReservationList) {
      c.selfReservation = "MyReservation";
      c.myReservationList = c.data.myReservationList;
    }
  }

  c.loadData = function (type, cancelRequest) {
    if (type == "myreservation") {
      c.selfReservation = "MyReservation";
      var actionData = {
        action: "myreservation",
      };

      if (cancelRequest) actionData.cancelRequest = cancelRequest;
      c.showLoading = true;
      c.server.get(actionData).then(function (r) {
        //console.log('r.data.myReservationList');
        //console.log(r);
        //console.log(r.data.myReservationList);
        c.myReservationList = r.data.myReservationList;
        c.showLoading = false;
      });
    }
  };
  /*
   */

  if (c.data.idcAssistResourceIntro) {
    for (var p = 0; p < c.data.idcAssistResourceIntro.length; p++) {
      c.data.idcAssistResourceIntro[p].description = $sce.trustAsHtml(
        c.data.idcAssistResourceIntro[p].description
      );
    }
  }
  if (c.data.idcAssistResource) {
    for (var t = 0; t < c.data.idcAssistResource.length; t++) {
      c.data.idcAssistResource[t].description = $sce.trustAsHtml(
        c.data.idcAssistResource[t].description
      );
    }
  }
  c.cancelReservation = function (cancelRequest) {
    c.cancelRequest = cancelRequest;
    c.modalInstance = $uibModal.open({
      templateUrl: "cancelReservationConfirmation",
      scope: $scope,
      backdrop: "static",
      windowClass: "iamSmallModal",
      size: "lg",
    });
  };

  c.cancelReservationConfirmation = function () {
    c.loadData("myreservation", cancelRequest);
  };

  c.redirectToHealthSafety = function () {
    c.selfReservation = "";
  };

  c.closeModal = function (cancelRequest) {
    if (cancelRequest) c.loadData("myreservation", c.cancelRequest);
    c.modalInstance.close();
  };

  function captureJourney(sys_id, table, notes) {
    c.server
      .get({
        action: "capture_journey",
        defSysId: "3045a21edbfd10143cce59b2ca96191d",
        sys_id: "db13bf14db80d45020df6e25ca9619f1",
        table: table,
        notes: notes,
      })
      .then(function (r) {});
  }

  c.selectTab = function (item) {
    c.currTab = item.id;
    var search = $location.search();
    if (search.tab != item.id) {
      $location.search({
        spa: 1,
        tab: item.id,
      });
    }
    c.tabs.forEach(function (tab) {
      tab.active_tab = tab.id == c.currTab;
    });
    $("#myTabContent").scrollTop(0);

    captureJourney("covid", "sp_widget", item.name);
  };
  $scope.$on("$locationChangeSuccess", function () {
    var search = $location.search();

    if (search.spa && search.tab !== c.currTab) {
      c.currTab = search.tab;
      var new_tab = c.tabs.find(function (tab) {
        return tab.id == search.tab;
      });
      c.tabs.forEach(function (tab) {
        tab.active_tab = tab.id == c.currTab;
      });
    }
    $("#myTabContent").scrollTop(0);
  });

  c.openInNewTab = function (link) {
    $window.open(link, "_blank");
  };
  c.openMfineApp = function () {
    var sysOS = c.getMobileOperatingSystem();
    var appLink =
      "https://play.google.com/store/apps/details?id=com.mfine&hl=en_IN&gl=US";
    if (sysOS == "iOS") {
      appLink =
        "https://apps.apple.com/in/app/mfine-consult-doctors-online/id1308944633";
      $window.open(appLink, "_blank");
    } else if (sysOS == "Android") {
      appLink =
        "https://play.google.com/store/apps/details?id=com.mfine&hl=en_IN&gl=US";
      $window.open(appLink, "_blank");
    } else if (sysOS == "Windows Phone") {
      appLink =
        "https://play.google.com/store/apps/details?id=com.mfine&hl=en_IN&gl=US";
      $window.open(appLink, "_blank");
    }
  };

  c.getMobileOperatingSystem = function () {
    var userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Windows Phone must come first because its UA also contains "Android"
    if (/windows phone/i.test(userAgent)) {
      return "Windows Phone";
    }

    if (/android/i.test(userAgent)) {
      return "Android";
    }

    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return "iOS";
    }

    return "unknown";
  };
};
