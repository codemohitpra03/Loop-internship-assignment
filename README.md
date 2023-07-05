# Loop-internship-assignment

Loop internship assignment for Store monitoring report

API Endpoints for report generation :-

1. /api/trigger_report
   - GET Request
   - Initializes the Report generation process
   - Returns a report_id in Response, which can be used to fetch the report

2. /api/get_report
   - GET Request
   - Returns the status and Report Response in CSV Format

Tech used - 
1. PostgresSQL as database
2. Node.js for writing server logic

   
Schema for Report :-
  store_id,
  uptime_last_hour(in minutes),
  uptime_last_day(in hours),
  update_last_week(in hours),
  downtime_last_hour(in minutes),
  downtime_last_day(in hours), 
  downtime_last_week(in hours)

Sources to calculate the uptime and downtime :-
  1. store_status(store_id, timestamp_utc, status)
  2. store_hours(store_id, dayOfWeek(0=Monday, 6=Sunday), start_time_local, end_time_local)
  3. store_timezone(store_id, timezone_str)

Firstly a master table is created using the three sources using these steps.
  1. Find the records for last seven days + current day from store_status table.
    - Current day records include those whose timestamp is less than time of request.
  2. Using this result, retrive a new result using store_hours table resulting the start and end time of stores in local time by extracting the date from last seven days.
  3. Using the result from 2 and store_timezone table we find the timezone of stores and convert the start and time of stores in utc. Because timestamp of status is in utc, so to compare first we need to convert store hours to utc
  4. From the result of 3 we select those rows whose timestamp is between the store hours.
  5. Now we Have our master table. Interpolation logic is applied on the status data points and stored int result table.
  6. The result table is sent as response.

Interpolation Logic for uptime and downtime calculation:-
  1. For last hour -

     -> The last hour timestamp is fetched from the master table.

     -> E.g. for the last hour we have data point as 3:21:56 AM and status - inactive. so we assume that the status would have been changed before the timestamp. Fow simplicity we assume that it changed at the timestamp.

     -> Hence downtime will be 60-21=39 minutes and uptime will be 21 minutes. Similarly we calculate for uptime.
   
   3. For last day -

      -> While computing master table, we group the result by store_id and then we order the time stamps in decreasing order.

      -> We select those records having date as yesterday for every store_id

      -> Again we use the same logic based on the assumption that the status changes at the time stamp. So the status remains same till the time stamp.

      -> We sum up the hours according to the status by subtracting adjacent timestamp data points and calculating uptime and downtime in hours.

      -> In this way we add the hours to uptime and downtime and return it.
   5. For last week -

      -> We use the same logic and assumption and calculate for every past seven day, sum up the results and return it. 
