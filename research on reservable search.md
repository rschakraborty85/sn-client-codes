# research on reservable search

> where does it start 
"search" function of wsdsearchservice calls WSDSearchService.searchForReservableUnits function builds the query for space table
> and then what 
WSDSearchService._resolveReservablesByGr function called from searchForReservableUnits function queries the whole set of data and iterates
> and then what 
WSDAvailabilityService.checkReservableAvailability function gets called from _resolveReservablesByGr
this takes care of finding out whether a particular seat is available within the searched date time 
> and then what 
if its available , it gets included in the final data set 

