api.controller = function ($scope, $window, $timeout, $uibModal, cabrillo) {
  var c = this;

  //STRY2461815 - Vacccine Changes
  //Start
  $scope.showVaccineReport = c.data.showVaccineReport;
  $scope.showVaccineTest = c.data.showVaccineTest;

  $scope.reportVaccinationLink = c.data.reportVaccinationLink;
  $scope.requestTestVaccinationLink = c.data.requestTestVaccinationLink;
  $scope.submitTestVaccinationLink = c.data.submitTestVaccinationLink;
  //End

  c.storeVisitorDataObjPast = ""; // RC - to store visitor obj , used later
  c.visitorInUrl = false;
  var initialUserType = "employee"; // default for portal
  if (c.data.mobile) {
    jQuery(".header-div").hide();
    if (c.data.view == "screener") initialUserType = "visitor"; // default for mobile
    cabrillo.viewLayout.setBottomButtons();
  }
  if (
    !c.data.mobile &&
    c.data.view == "screener" &&
    c.data.userType == "visitor"
  ) {
    initialUserType = c.data.userType;
    c.visitorInUrl = true;
  }
  // @note - most important function - reloads the status message and requirement from bottom widget
  $rootScope.$on("onTravelOrReservationSelected", function (event, data) {
    $timeout(function () {
      console.log(
        "RC in EHSS widget ; rootscope.on onTravelOrReservationSelected \n" +
          // JSON.stringify(event) +
          // "\n" +
          JSON.stringify(data)
      );
      if (!data.isSelected) {
        $scope.userStatus.selectUser($scope.userStatus.baseData.userId);
        return;
      }
      // RC - for testing only
      $scope.userStatus.baseData.user_display_field = data.display_field;
      $scope.userStatus.baseData.cleared = data.requirements_status.status;
      $scope.userStatus.baseData.cleared_message =
        data.requirements_status.statusMessage;
      $scope.userStatus.baseData.reqs =
        data.requirements_status.locationRequirements;
    }, 1000);
  });
  //   RC - set defaults , printer
  $scope.visitor_printer_location = {
    displayValue: c.data.printer_display_default,
    value: c.data.printer_sys_id_default,
    name: "visitor_printer_location",
  };
  // RC - visitor 2nd phase ; STRY2443341
  $scope.wsd_visitor_printer_picker = {
    displayValue: c.data.wsd_default_printer
      ? c.data.wsd_default_printer.display_value
      : "",
    value: c.data.wsd_default_printer ? c.data.wsd_default_printer.value : "",
    name: "wsd_visitor_printer_picker",
  };
  // RC - visitor 2nd phase ; STRY2443341
  $scope.wsd_visitor_registration_picker = {
    displayValue: "",
    value: "",
    name: "wsd_visitor_registration_picker",
  };
  // RC - visitor 2nd phase ; STRY2443341
  c.wsdPrinterPickerChanged = function () {
    //
  };
  // RC - visitor 2nd phase ; STRY2443341
  c.wsdVisitorPickerChanged = function () {
    //
  };
  // RC - visitor 2nd phase ; STRY2443341
  c.wsdRedirectToRegistration = function () {
    var sys_id = $scope.userStatus.selUser.value;
    $window.open(
      "/sn_wsd_visitor_visitor_registration.do?sysparm_query=sys_id=" + sys_id,
      //   "?id=form&sys_id=" +
      //     sys_id +
      //     "&table=sn_wsd_visitor_visitor_registration&view=badge_print",
      "_blank"
    );
  };
  // RC - visitor 2nd phase ; STRY2443341
  c.wsdShowTemperatureScreeningVisitor = function () {
    $window.open(
      "/health_updates?id=sc_cat_item&sys_id=ca388f7d73a110101ba8dca09ff6a7d4" +
        "&sysparm_category=null&catalog_id=-1" +
        "&requester=" +
        $scope.userStatus.selUser.value +
        "&visitor=" +
        c.ehs_visitor_invite_id +
        "&building_id=" +
        c.ehs_visitor_building_id,
      "_blank"
    );
  };
  $scope.userStatus = {
    userType: initialUserType,
    isLoading: false,
    baseData: {},
    selId: c.data.userId,
    selUser: {
      displayValue: c.data.user,
      value: c.data.userId,
      name: "None",
    },
    _connect: function (ID, printer_config_id, printer_changed) {
      this.isLoading = true;
      var _self = this;
      c.server
        .get({
          action: "fetch_user_status",
          sysparm_details: ID,
          type: this.userType,
          wsd_printer_config_id: printer_config_id,
          //is_printer: isPrinter,
        })
        .then(function (spresponse) {
          _self.isLoading = false;
          _self.baseData = spresponse.data;

          // RC - visitor 2nd phase ; STRY2443341
          c.data.isEhsRequired = spresponse.data.isEhsRequired;
          c.shorten = spresponse.data.required_badge_print_data;
          c.ehs_visitor_invite_id = spresponse.data.ehsVisitorInvitationSysID;
          c.ehs_visitor_building_id =
            spresponse.data.ehsVisitorRegistrationBuildingID;
          c.is_dpl = spresponse.data.is_dpl;
          // end

          c.storeVisitorDataObjPast = spresponse.data.visitorBadgeDataObj; // RC
          c.data.visitor_query = spresponse.data.visitor_query; // RC
          if (printer_changed) {
            _self.selUser.displayValue = "";
            _self.selUser.value = "";
          }
        });
    },
    selectUser: function (ID, name, printer_config_id, printer_changed) {
      //isPrinter
      if (this.selId == ID) {
        return true;
      }
      this.selId = ID;
      this._connect(ID, printer_config_id, printer_changed);
    },
    selectVisitor: function (ID, name) {
      if (this.selId == ID) {
        return true;
      }
      this.selId = ID;
      this._connect(ID);
    },
  };

  if (c.data.view == "screener") {
    c.qrScan = true;
    if (c.data.mobile) {
      c.qrScan = false;
    }
  }
  c.showTemperatureScreening = function (popup) {
    if (!c.data.mobile) {
      $window.open(
        "/health_updates?id=sc_cat_item&sys_id=e311f2f7d1201010fa9bfb59dd736f41" +
          "&sysparm_category=null&catalog_id=-1&requester=" +
          $scope.userStatus.selUser.value,
        "_self"
      );
    } else {
      $window.location.href =
        "mesp?id=sc_cat_item&sys_id=e311f2f7d1201010fa9bfb59dd736f41" +
        "&requester=" +
        $scope.userStatus.selUser.value;
    }
  };
  //   RC - temp screen for visitor --
  c.showTemperatureScreeningVisitor = function () {
    var visitor_sys_id = "";
    if (c.visitorInUrl) {
      visitor_sys_id = c.data.userId;
    } else {
      var short_modified = c.storeVisitorDataObjPast.visitor_invite_obj;
      visitor_sys_id = short_modified.sys_id.display_value;
    }

    if (!c.data.mobile) {
      $window.open(
        "/health_updates?id=sc_cat_item&sys_id=ca388f7d73a110101ba8dca09ff6a7d4" +
          "&sysparm_category=null&catalog_id=-1" +
          "&requester=" +
          $scope.userStatus.selUser.value +
          "&visitor=" +
          visitor_sys_id,
        "_self"
      );
    } else {
      $window.location.href =
        "mesp?id=sc_cat_item&sys_id=ca388f7d73a110101ba8dca09ff6a7d4" +
        "&sysparm_category=null&catalog_id=-1&requester=" +
        $scope.userStatus.selUser.value +
        "&visitor=" +
        visitor_sys_id;
    }
  };
  //   RC - print badge function
  c.printVisitorBadge = function (data_url, badge_sys_id) {
    c.server
      .get({
        action: "print_visitor_badge",
        sysparm_details: $scope.userStatus.selUser.value,
        type: $scope.userStatus.userType,
        data_url: data_url,
        badge_sys_id: badge_sys_id,
      })
      .then(function (response) {
        //if (response) c.modalInstance.close();
        $window.alert("Printing badge...");
        c.close();
      });
  };
  //   RC - visitor app features - close modal
  c.close = function () {
    c.modalInstance.close();
  };

  //   RC - visitor app features
  c.previewVisitorBadge = function () {
    // if (!c.data.mobile) {
    if ($scope.visitor_printer_location.value == "") {
      $window.alert("Please select a printer...");
      return;
    }
    // get older visitor record if it exist
    // before sign in - todays u_visitor record doesnt exist yet
    var lastVisit = {};
    if (c.storeVisitorDataObjPast.visitor_invite_obj) {
      var short_modified = c.storeVisitorDataObjPast.visitor_invite_obj;
      lastVisit.date_time = short_modified.visit_date_time.display_value;
      lastVisit.location = short_modified.location.display_value;
      lastVisit.count = c.storeVisitorDataObjPast.total_visit_count;
    }

    // generate the badge record without printing it
    c.server
      .get({
        action: "preview_visitor_badge",
        sysparm_details: $scope.userStatus.selUser.value,
        type: $scope.userStatus.userType,
        printer_value: $scope.visitor_printer_location.value,
      })
      .then(function (response) {
        // past obj is not set when visitor id is passed in url
        //   set it again
        if (!c.storeVisitorDataObjPast.visitor_invite_obj) {
          c.storeVisitorDataObjPast = response.data.visitorBadgeDataObj;

          var short_modified = c.storeVisitorDataObjPast.visitor_invite_obj;
          lastVisit.date_time = short_modified.visit_date_time.display_value;
          lastVisit.location = short_modified.location.display_value;
          lastVisit.count = c.storeVisitorDataObjPast.total_visit_count;
        }
        var visitorBadgePrintObj = response.data.visitorBadgePrintObj;
        var data_url = drawVisitorBadge(
          visitorBadgePrintObj.u_number.display_value,
          visitorBadgePrintObj.u_full_name.display_value,
          visitorBadgePrintObj.u_company.display_value,
          visitorBadgePrintObj.u_host.display_value,
          visitorBadgePrintObj.sys_created_on.display_value
        );
        c.modalInstance = $uibModal.open({
          templateUrl: "visitor-print-badge-modal",
          scope: $scope,
          controller: function ($scope, $uibModalInstance) {
            var that = $scope;
            that.record = {
              data_url: data_url,
              badge_sys_id: visitorBadgePrintObj.sys_id.display_value,
              last_visit_time: lastVisit.date_time,
              last_visit_loc: lastVisit.location,
              visit_count: lastVisit.count,
              isMobile: c.data.mobile,
            };
          },
        });
      });
    // }
  };
  //   RC - draw the visitor data on a canvas
  //  that will be printed on the badge
  function drawVisitorBadge(id, name, company, host, date) {
    try {
      var canvas = angular.element.find(".hidden_canvas_badge_print")[0];
      var context = canvas.getContext("2d");
      context.fillStyle = "rgba(255,255,255,1)";
      context.fillRect(0, 0, 350, 215);
      context.fillStyle = "rgba(52,52,52,1)";
      context.font = "12pt ArialRoundedMTBold";
      //   RC - data will be filled in here
      context.fillText("ID: " + id, 50, 70);
      context.fillText("Name: " + name, 50, 100);
      context.fillText("Company: " + company, 50, 130);
      context.fillText("Host: " + host, 50, 160);
      context.fillText("Date: " + date, 50, 190);

      context.beginPath();
      context.lineWidth = 3;
      context.moveTo(0, 0);
      context.lineTo(350, 0);
      context.stroke();

      context.moveTo(350, 0);
      context.lineTo(350, 215);
      context.stroke();

      context.moveTo(350, 215);
      context.lineTo(0, 215);
      context.stroke();

      context.moveTo(0, 215);
      context.lineTo(0, 0);
      context.stroke();

      var logo = new Image();
      logo.src = "/snc_logo_small_new_b_w.png";
      if (c.data.mobile) {
        context.drawImage(logo, 50, -18);
      } else {
        context.drawImage(logo, 50, -18, 250, 80);
        //context.drawImage(logo, 50, -18, 218, 41);
      }

      var dataURL = canvas.toDataURL("image/png");

      return dataURL; // use this to draw image on modal
    } catch (error) {
      alert(error);
    }
  }
  c.showPPEAssignment = function (popup) {
    //sc_catalog=706540f4db9d1300b2e2d34b5e961919&sc_category=undefined&sc_cat_item=32682fc0e8301010fa9b2459bdecd54f
    if (!c.data.mobile) {
      $window.open(
        "/health_updates?id=sc_cat_item&sys_id=32682fc0e8301010fa9b2459bdecd54f" +
          "&sysparm_category=null&catalog_id=706540f4db9d1300b2e2d34b5e961919&requester=" +
          $scope.userStatus.selUser.value,
        "_self"
      );
    } else {
      $window.location.href =
        "/mesp?id=sc_cat_item&sys_id=32682fc0e8301010fa9b2459bdecd54f" +
        "&sysparm_category=null&catalog_id=706540f4db9d1300b2e2d34b5e961919&requester=" +
        $scope.userStatus.selUser.value;
    }
  };

  $scope.$on("field.change", function (evt, parms) {
    // RC - if visitor record picker
    if (
      parms.field.name === "None" ||
      parms.field.name == "visitor_printer_location" ||
      parms.field.name == "wsd_visitor_printer_picker"
    ) {
      if (parms && parms.field && !parms.field.value) {
        $scope.userStatus.isLoading = true;
        $scope.userStatus.selId = "";
        $scope.userStatus.isLoading = false;
        $rootScope.$broadcast("getReservations", {
          user_type: $scope.userStatus.userType,
          user: "",
        });
      }
      if (
        parms &&
        parms.field &&
        parms.field.value &&
        parms.field.value != parms.oldValue
      ) {
        // @note handled in upcoming workplace reservation widget - displayed at bottom of the page
        // console.log(
        //   "RC - within scope.on ; " +
        //     $scope.userStatus.userType +
        //     "\n" +
        //     parms.field.value
        // );
        $rootScope.$broadcast("getReservations", {
          user_type: $scope.userStatus.userType,
          user: parms.field.value,
        });
        if (parms.field.name == "visitor_printer_location") {
          $scope.userStatus.selectUser(
            parms.field.value,
            parms.field.displayValue,
            $scope.visitor_printer_location.value,
            true
          );
        }
        // @note RC - visitor 2nd phase ; STRY2443341
        else if (parms.field.name == "wsd_visitor_printer_picker") {
          c.server
            .get({
              action: "wsd_printer_changed",
              wsd_printer_config_id: $scope.wsd_visitor_printer_picker.value,
              type: "visitor",
            })
            .then(function (response) {
              c.data.wsd_visitor_query = response.data.wsd_visitor_query;
              // reset dropdown
              $scope.wsd_visitor_registration_picker.value = "";
              $scope.wsd_visitor_registration_picker.displayValue = "";
            });
        } else {
          $scope.userStatus.selectUser(
            parms.field.value,
            parms.field.displayValue,
            $scope.wsd_visitor_printer_picker.value, // RC - visitor 2nd phase ; STRY2443341
            //$scope.visitor_printer_location.value,
            false
          );
        }
        $scope.showPrinter = true; // RC - show selection of printer for visitors
      }
    }
  });
  scope.$watch("userStatus.userType", function (newValue, oldValue, scope) {
    if (newValue && newValue != oldValue) {
      scope.userStatus.isLoading = true;
      scope.userStatus.selUser.displayValue = "";
      scope.userStatus.selUser.value = "";
      scope.userStatus.selId = "";
      scope.userStatus.isLoading = false;
      $rootScope.$broadcast("getReservations", {
        user_type: $scope.userStatus.userType,
        user: "",
      });
    }
  });
  (function () {
    $scope.userStatus.isLoading = true;
    $scope.userStatus.baseData = c.data;
    $scope.userStatus.isLoading = false;
    $scope.showPrinter = false; // RC - dont show printer unless visitor selected
  })();

  $timeout(focusEmployeeSelector, 500);

  function focusEmployeeSelector() {
    try {
      if (
        $("#s2id_employee_picker") &&
        $("#s2id_employee_picker").find("input") &&
        $("#s2id_employee_picker").find("input").length > 0
      )
        $("#s2id_employee_picker").find("input")[0].focus();
    } catch (err) {}
  }

  c.screenAnotherEmployee = function () {
    $scope.userStatus.selUser.displayValue = "";
    $scope.userStatus.selUser.value = "";
    $scope.userStatus.selId = "";
    $timeout(focusEmployeeSelector, 500);
  };

  //STRY2461815 - Vaccine Changes
  //Start
  c.processRequirementEvent = function (req) {
    if (req.requirement_id == c.data.vaccineRequirementId) {
      c.modalInstance = $uibModal.open({
        templateUrl: "vaccinationPopUpFromStatus",
        size: "md",
        scope: $scope,
        windowClass: "vaccinationpopup",
      });
    }
  };

  $scope.closeModal = function () {
    c.modalInstance.close();
  };
  //End
  //   c.focusElement = function () {
  //     //$('employee_picker').focus();
  //     document.getElementById("assignppe").focus();
  //   };
  //$('employee_picker').focus();
};
