# location based rtw status page changes
# story no : STRY2462904 (Health screener screen - View employee RTW status page)

> first analyze and merge Upcoming Workplace Reservations widget 
> what does the surf version of the widget looks like - html
> first it shows shift user details - with new changes this is not necessary anymore
second : it shows reservations - this will be required - need to check if we need anything from here or can we move oob directly 
> it doesnt allow showing the table in mobile - the whole code is hidden if its mobile view
> first it iterates through the list of shifts
and then it iterates through the list of reservations via a simple html table row UI
> shift doesnt have any action whereas reservation has one - cancel reservation 
>> conclusion - by looking at the html - it feels like we can revert to oob and show it on screener view
> revert to oob is complete!!!

================================================================================================

> now the major work which is to analyze employee_health_and_safety_status widget
> major customization alert !!!
> so far - by looking at the code - its highly unlikely we can find differences since the customization is too much 
only way to go forward with given time is to add the required code to make it work the way we want 

> analyzing HTML section 
high level collapsing done 
will start annotating each section for better clarity
> marked all html components for both oob and custom
> now detail out 