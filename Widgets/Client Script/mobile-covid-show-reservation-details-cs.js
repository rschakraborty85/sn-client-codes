api.controller = function ($scope) {
  /* widget controller */

  var c = this;

  var elems = document.getElementsByClassName("modal-body");
  Array.prototype.filter.call(elems, function (testElement) {
    testElement.style.padding = "0px";
  });

  $scope.closemodal = function () {
    $scope.$parent.$parent.buttonClicked({
      label: "Cancel",
      cancel: true,
    });
  };
};
