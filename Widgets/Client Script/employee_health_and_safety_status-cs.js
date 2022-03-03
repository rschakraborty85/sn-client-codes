api.controller = function ($rootScope, $scope, spUtil) {
  var c = this;

  // @note binding object which makes get / set values of record picker
  $scope.userStatus = {
    userType: "employee",
    isLoading: false,
    baseData: {},
    selId: c.data.userId,
    selUser: {
      displayValue: c.data.user,
      value: c.data.userId,
      name: "None",
    },
    _connect: function (ID) {
      this.isLoading = true;
      var _self = this;
      c.server
        .get({
          action: "fetch_user_status",
          sysparm_details: ID,
          type: this.userType,
        })
        .then(function (spresponse) {
          _self.isLoading = false;
          _self.baseData = spresponse.data;
        });
    },
    // @note - to reload new user data via server call
    selectUser: function (ID, name) {
      /*
			if(this.selId == ID){
				return true;
			}
			*/
      this.selId = ID;
      this._connect(ID);
    },
  };
  // @note - most important function - reloads the status message and requirement from bottom widget
  $rootScope.$on("onTravelOrReservationSelected", function (event, data) {
    if (!data.isSelected) {
      $scope.userStatus.selectUser($scope.userStatus.baseData.userId);
      return;
    }
    $scope.userStatus.baseData.cleared = data.requirements_status.status;
    $scope.userStatus.baseData.cleared_message =
      data.requirements_status.statusMessage;
    $scope.userStatus.baseData.reqs =
      data.requirements_status.locationRequirements;
  });
  // @note - triggers when the record picker changes
  $scope.$on("field.change", function (evt, parms) {
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
      $rootScope.$broadcast("getReservations", {
        user_type: $scope.userStatus.userType,
        user: parms.field.value,
      });
      $scope.userStatus.selectUser(parms.field.value, parms.field.displayValue);
    }
  });
  // @note - when the radio button changes
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
  })();
};
