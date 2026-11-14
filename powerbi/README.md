# Power BI

The Snowflake `CLEAN` schema is the reporting contract. Follow
[DAX_MEASURES.md](DAX_MEASURES.md) for relationships, measures, currency
handling and report pages. The repository does not include a `.pbix` file
because a real Power BI model requires a tenant/workspace and authenticated
Snowflake connection. Build and publish the report from the documented CLEAN
model after the Snowflake pipeline has loaded data.
