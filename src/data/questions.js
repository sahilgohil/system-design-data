/* Quiz question bank for System Design for Data Engineering.
 *
 * Questions are scenario-first wherever possible: describe a situation, ask
 * which idea applies. Explanations say why the right answer is right AND why
 * the most tempting wrong one is wrong.
 */
window.QUIZ = {
  categories: {
    foundations: 'Foundations',
    blocks: 'Building blocks',
    hardparts: 'The hard parts',
    design: 'Designing systems'
  },

  questions: [
    {
      c: 'foundations',
      q: 'An analyst runs a report that sums one column across 800 million rows. It takes 40 minutes on the company Postgres and 4 seconds on the warehouse. What is the main reason?',
      o: [
        'The warehouse reads far fewer bytes, because column storage keeps each column together',
        'The warehouse has faster disks and more memory',
        'Postgres was not indexed on that column',
        'The warehouse caches the result of every query'
      ],
      a: 0,
      e: 'Summing one column out of 200 means a column store reads roughly 1/200th of the data, and that column compresses well because every value is the same type. The tempting wrong answer is hardware — but a bigger Postgres box would still have to read every column of every row, because row storage interleaves them on disk. The win is bytes read, not speed of reading.'
    },
    {
      c: 'foundations',
      q: 'A stakeholder says "we need this dashboard in real time." What is the most useful first response?',
      o: [
        'Ask what decision they make with it, and how quickly they make it',
        'Design a Kafka and Flink pipeline, since that is what real-time requires',
        'Explain that real-time is not possible within their budget',
        'Agree to five-minute refreshes as a compromise'
      ],
      a: 0,
      e: 'The freshness requirement follows from the decision being made. Ask, and "real-time" usually turns out to mean "yesterday feels stale", which hourly solves at a fraction of the cost. Jumping to a compromise number is tempting because it feels collaborative, but you still have not learned whether five minutes is over- or under-shooting — you have only guessed more precisely.'
    },
    {
      c: 'foundations',
      q: 'Which statements about OLTP and OLAP systems are correct? (Choose two.)',
      o: [
        'OLTP is optimised for latency on small requests; OLAP for throughput on large ones',
        'OLAP always contains older data than OLTP, by design',
        'OLTP typically uses row-oriented storage, OLAP column-oriented',
        'OLAP systems cannot serve interactive queries'
      ],
      a: [0, 2],
      e: 'The real distinction is workload shape and the storage layout that follows from it. The two wrong options come from the same misconception — that OLAP means "slow and stale". Freshness is an independent axis you choose separately, and modern OLAP engines answer interactive queries in seconds.'
    },
    {
      c: 'foundations',
      q: 'A design meets its freshness target and its budget, but only one engineer understands how it works. Which of the four constraints has been traded away?',
      o: [
        'Maintainability',
        'Correctness',
        'Cost',
        'Freshness'
      ],
      a: 0,
      e: 'Maintainability is whether someone else can understand, change and debug the system in a year. It is the constraint most often sacrificed silently, because unlike cost and freshness it shows up on no dashboard until the person who understood it leaves. Cost is arguably affected too — engineer time is a real cost — but the direct trade here is maintainability.'
    },

    {
      c: 'blocks',
      q: 'You ingest a Postgres orders table using WHERE updated_at > :last_watermark. Six months later, order counts in the warehouse are higher than in the source. What is the most likely cause?',
      o: [
        'Cancelled orders are hard-deleted in the source, and a watermark query cannot see deletes',
        'The watermark runs too frequently and pulls overlapping rows',
        'Parquet compression is corrupting rows',
        'The source has more rows than the warehouse and the report is misreading it'
      ],
      a: 0,
      e: 'A deleted row is never "greater than the watermark", so it is never pulled again and never removed. Your copy keeps it forever, with no error anywhere. Overlapping pulls are the tempting answer because they do cause duplicates — but those would show as repeated primary keys, which a uniqueness test catches. Missing deletes show as a clean-looking table that is simply too big.'
    },
    {
      c: 'blocks',
      q: 'A streaming job writes one Parquet file every 30 seconds. After a year, queries over the table are extremely slow even though total data volume is modest. What is happening, and what fixes it?',
      o: [
        'Small file overhead — schedule a compaction job to rewrite them into larger files',
        'The files are over-compressed — reduce the compression level',
        'The table needs more partitions to spread the load',
        'The query engine is undersized — increase the cluster'
      ],
      a: 0,
      e: 'That schedule produces about a million files a year, and per-file overhead (list, open, read footer) dominates the actual reading. Compaction rewrites them into 128 MB–1 GB files. More partitions is the trap: it sounds like the standard performance lever, but it would make things worse by creating even more, even smaller files.'
    },
    {
      c: 'blocks',
      q: 'A 5 TB events table is queried almost exclusively with filters on event_date, and occasionally on user_id (10 million distinct users). What layout is right?',
      o: [
        'Partition by event_date, cluster by user_id',
        'Partition by both event_date and user_id',
        'Partition by user_id, cluster by event_date',
        'No partitioning — rely on the query engine to optimise'
      ],
      a: 0,
      e: 'Partition on the low-cardinality column you filter on most (date), and cluster on the high-cardinality one so file statistics stay selective. Partitioning by user_id is the classic disaster: 10 million directories each holding a few kilobytes, which destroys performance rather than helping it. The rule is that thousands of distinct values or more means cluster, not partition.'
    },
    {
      c: 'blocks',
      q: 'A Spark job that normally takes 8 minutes now takes 90. Task durations show 199 tasks finishing in under a minute and one running for over an hour. What is the problem?',
      o: [
        'Skew — one join key value holds a disproportionate share of the rows',
        'The cluster is too small and needs more nodes',
        'The input files are corrupt',
        'The shuffle partition count is set too high'
      ],
      a: 0,
      e: 'That task-duration profile is the signature of skew. A single dominant key — often a NULL user_id or a "guest" account — forces all its rows onto one node. Adding nodes is the tempting answer and does nothing at all here, because the bottleneck is one task that cannot be split. Fix the key distribution instead.'
    },
    {
      c: 'blocks',
      q: 'What is the strongest argument for landing raw source data unmodified before parsing it?',
      o: [
        'When you find a parsing bug later, you can reprocess history instead of losing it',
        'Raw data is cheaper to store than parsed data',
        'It makes the pipeline run faster',
        'Compliance requires keeping original files'
      ],
      a: 0,
      e: 'Parsing logic has bugs and vendors add fields. If the raw payload was kept, discovering that in six months is an afternoon of reprocessing; if it was not, it is six months of unrecoverable data. Cost is the tempting distractor — raw is often larger than the parsed version, so this habit costs a little storage. It buys recoverability, which is worth far more.'
    },
    {
      c: 'blocks',
      q: 'Which task is idempotent?',
      o: [
        'DELETE FROM sales WHERE dt = :logical_date, then INSERT ... WHERE dt = :logical_date',
        'INSERT INTO sales SELECT ... WHERE dt = :logical_date',
        'INSERT INTO sales SELECT ... WHERE dt = CURRENT_DATE',
        'INSERT INTO sales SELECT ... WHERE created_at > (SELECT MAX(created_at) FROM sales)'
      ],
      a: 0,
      e: 'Delete-then-insert scoped to the same partition produces the same result however many times it runs. The bare INSERT is the trap: it looks correct because it is parameterised by logical date, but a retry after a partial failure adds a second copy of the rows. Parameterisation and idempotency are separate properties, and you need both.'
    },
    {
      c: 'blocks',
      q: 'In June you rerun a pipeline task for 1 March to fix a bug. The task uses CURRENT_DATE internally. What happens?',
      o: [
        'June data is written into March\u2019s partition, and the run reports success',
        'The task fails with a date range error',
        'The task correctly reprocesses March, because the orchestrator overrides the date',
        'Nothing — the task is a no-op because March is already populated'
      ],
      a: 0,
      e: 'This is exactly why the logical-date rule exists. The task asks the system what day it is, gets June, and writes June data into a March-labelled partition. Nothing errors, the DAG turns green, and history is now wrong in a new and more confusing way. Orchestrators expose a logical date so tasks never need to ask.'
    },

    {
      c: 'hardparts',
      q: 'Why can a message system not truly guarantee exactly-once delivery at the transport layer?',
      o: [
        'A lost acknowledgement is indistinguishable from a lost message, so the sender must choose between retrying and not',
        'Network protocols do not support acknowledgements',
        'Clocks between machines are never perfectly synchronised',
        'It is possible, but only on a single machine'
      ],
      a: 0,
      e: 'The sender transmits and gets no acknowledgement. Either the message never arrived, or it arrived and the acknowledgement was lost — and nothing available to the sender distinguishes those cases. So it retries (duplicates) or does not (loss). Clock skew is a real problem elsewhere, but it is not what makes this one unsolvable. The practical answer is at-least-once plus an idempotent write.'
    },
    {
      c: 'hardparts',
      q: 'A source has no unique identifier. A colleague suggests generating a UUID for each row at ingestion time to use as a deduplication key. What is wrong with this?',
      o: [
        'The UUID differs on every rerun, so duplicates from a retry get different keys and are never detected',
        'UUIDs are too large to index efficiently',
        'Nothing — this is the standard approach',
        'UUIDs are not guaranteed to be unique'
      ],
      a: 0,
      e: 'Deduplication requires that the same logical record produces the same key every time. A random UUID assigned at ingestion guarantees the opposite: the retry that created the duplicate also creates a fresh key for it. The correct fallback is a deterministic hash of the fields defining uniqueness. This one is dangerous because it looks like a solution and passes casual review.'
    },
    {
      c: 'hardparts',
      q: 'A mobile app buffers events while offline, so Monday-night purchases arrive on Thursday. Monday\u2019s daily total was computed on Tuesday morning. What is the standard batch fix?',
      o: [
        'Reprocess a rolling lookback window sized from the measured lateness distribution',
        'Reject events whose event_time is older than the current partition',
        'Switch the entire pipeline to streaming with watermarks',
        'Use ingestion time instead of event time for daily totals'
      ],
      a: 0,
      e: 'Measure ingested_at minus event_time across a sample, take the p99.9, and reprocess that many days on every run — which is only safe because the write is idempotent. Using ingestion time is the trap: it makes totals stable and permanently wrong, since Monday\u2019s purchases get counted on Thursday. Stability is not correctness.'
    },
    {
      c: 'hardparts',
      q: 'An upstream team changes an amount column from dollars to cents. The data type stays the same. Which control catches this?',
      o: [
        'A distribution test — checking whether values fall in an expected range',
        'A not-null test on the column',
        'Schema validation',
        'A uniqueness test on the primary key'
      ],
      a: 0,
      e: 'Every value is well-formed, the type is unchanged, and nothing errors — this is the semantic change that makes schema validation insufficient. Only a test looking at the values notices that the average order suddenly rose a hundredfold. Schema checks are the tempting answer because they catch most changes, but they are blind to exactly this one.'
    },
    {
      c: 'hardparts',
      q: 'A dashboard suddenly shows exactly double the expected revenue. Which single test would most likely have caught the cause at build time?',
      o: [
        'A uniqueness test on the dimension table primary key',
        'A freshness test on the fact table',
        'A not-null test on the revenue column',
        'A volume test on the raw landing table'
      ],
      a: 0,
      e: 'A duplicate row in a dimension makes every join through it return two rows instead of one, silently doubling any measure, and it produces no error. If you write only one test per table, write this one. A volume test is a reasonable guess, but the duplication takes effect at join time in the mart, not in the raw table where a row count would look.'
    },
    {
      c: 'hardparts',
      q: 'Which of these should be blocking (stop the pipeline) rather than merely warning? (Choose two.)',
      o: [
        'Primary key uniqueness on a mart feeding financial reporting',
        'A heuristic check that daily volume is within 20% of the trailing average',
        'Revenue reconciliation against the payment provider\u2019s own reported total',
        'A check that a rarely-used optional field is populated more than 90% of the time'
      ],
      a: [0, 2],
      e: 'Block where publishing wrong data is worse than publishing nothing — broken keys and failed reconciliation both mean the numbers cannot be trusted. The other two are soft thresholds that will fire on normal variation. Blocking on everything produces a pipeline that halts weekly and an alert channel everyone mutes, which is worse than no alerting because it looks like monitoring.'
    },
    {
      c: 'hardparts',
      q: 'A fact table has some rows representing whole orders and some representing individual line items. What is the consequence?',
      o: [
        'The grain is mixed, so summing revenue double-counts — and the error is invisible until someone reconciles',
        'Queries will be slower, but results remain correct',
        'The table can no longer be partitioned by date',
        'Dimensions can no longer be joined to it'
      ],
      a: 0,
      e: 'Grain is what one row represents, and mixing it is the root of most dimensional modelling disasters. Nothing errors — the SQL runs, the joins work, the totals are simply wrong. This is why you declare the grain in one sentence beginning "one row per…" before writing any SQL, rather than discovering it afterwards.'
    },
    {
      c: 'hardparts',
      q: 'A customer moves from Berlin to Munich in July. The business needs last year\u2019s orders to still show as Berlin. What does this require?',
      o: [
        'A Type 2 slowly changing dimension, with facts joined on a surrogate key',
        'A Type 1 dimension, overwriting the city',
        'Storing the city directly on the fact table only',
        'Partitioning the dimension by city'
      ],
      a: 0,
      e: 'Type 2 adds a new row per version with validity dates, and facts join to the surrogate key for the version current at the time — that is what "point-in-time correct" means. Type 1 is the trap: simpler, and it silently rewrites history, so last year\u2019s Berlin orders retroactively become Munich orders with no record that anything changed.'
    },
    {
      c: 'hardparts',
      q: 'A team\u2019s warehouse bill triples. Their own pipeline jobs have not changed. Where should they look first?',
      o: [
        'Consumption — dashboards and ad-hoc queries repeatedly scanning large tables',
        'Storage growth from retaining raw data',
        'The cost of the orchestrator',
        'Network egress between regions'
      ],
      a: 0,
      e: 'The consumption side is often larger than the pipeline and is the side nobody instruments. A dashboard auto-refreshing every minute across ten open screens issues over 14,000 queries a day. Storage is the intuitive guess because raw retention feels wasteful, but at roughly $25 per TB per month it is rarely the driver — compute on data scanned is.'
    },

    {
      c: 'design',
      q: 'In a design interview you are asked to design analytics for a food delivery app. What should you do first?',
      o: [
        'Ask for numbers: volume, growth, freshness, query patterns, budget',
        'Sketch a Kafka, Spark and Snowflake architecture',
        'Ask whether they prefer a warehouse or a lakehouse',
        'Start with the data model, since everything depends on it'
      ],
      a: 0,
      e: 'Every subsequent choice is only defensible against stated numbers, and asking for them is the clearest available signal of experience. Starting with the data model is the most tempting wrong answer, because modelling genuinely is foundational — but you cannot choose a grain without knowing which questions are being asked, and that comes from step one.'
    },
    {
      c: 'design',
      q: 'A source table has 80 million rows, records are updated after creation, and deleted rows must disappear from the warehouse. Which ingestion pattern fits?',
      o: [
        'CDC from the replication log',
        'Full snapshot every run',
        'Incremental on updated_at',
        'Event streaming published by the application'
      ],
      a: 0,
      e: 'Mutability plus deletes plus size points to CDC — the only pattern that sees deletes without rescanning the table. A full snapshot would also catch deletes and is the tempting answer, but 80 million rows every run is heavy load for something CDC does continuously and almost for free. Events would be better data, but you cannot choose them unilaterally; they require the producing team to publish them.'
    },
    {
      c: 'design',
      q: 'You have been asked to "build a data platform", with no further detail. What is the best first move?',
      o: [
        'Find one consumer with one question and build a thin end-to-end slice, with tests and monitoring from day one',
        'Design the full architecture for all anticipated sources before building anything',
        'Ingest every available source into a lake so the data is ready when needed',
        'Choose the tooling first, so later decisions stay consistent'
      ],
      a: 0,
      e: 'Platforms grown from one working pipeline consistently beat platforms designed for imagined needs, because the imagined needs are wrong in ways you cannot discover without a real consumer — and each wrong guess becomes a constraint. Ingesting everything first is tempting because it feels like progress, but it produces a lake of untested data nobody has validated against a real question.'
    },
    {
      c: 'design',
      q: 'A Lambda-shaped design has a stream computing live counters and a batch job computing sessions and funnels. Does the usual criticism of Lambda apply?',
      o: [
        'No — the two paths compute different things, so there is no shared logic to drift',
        'Yes — the two paths will inevitably drift apart and disagree',
        'Yes — Lambda architectures cannot handle late-arriving data',
        'Yes — it requires exactly-once delivery, which is unavailable'
      ],
      a: 0,
      e: 'Lambda\u2019s famous flaw is maintaining two implementations of the same business logic, which drift. Here the paths answer different questions, so nothing shared can diverge. The general criticism is tempting because it is repeated so often — but the test is whether both paths implement the same definition, not whether the architecture is Lambda-shaped.'
    },
    {
      c: 'design',
      q: 'Which questions belong in the "break it on purpose" step of a design review? (Choose two.)',
      o: [
        'What is the blast radius if someone reruns last month by accident?',
        'If the source is down for twelve hours, do we alert, wait, or publish stale data?',
        'Which cloud provider offers the best pricing for this workload?',
        'What naming convention should the tables use?'
      ],
      a: [0, 1],
      e: 'The failure-mode walk-through is about what the system does when things go wrong, and both correct options describe realistic incidents with real decisions attached. The other two are legitimate questions in their own right, but they belong to procurement and conventions — asking them here skips the step that most distinguishes a strong design from a merely plausible one.'
    },
    {
      c: 'design',
      q: 'A team of two must serve 12 analysts querying about 3 TB of data with SQL. What storage architecture is most appropriate?',
      o: [
        'A cloud data warehouse',
        'A lakehouse on Iceberg over S3, for openness and scale',
        'A Postgres read replica of the application database',
        'A Spark cluster reading raw Parquet directly'
      ],
      a: 0,
      e: 'Under roughly 10 TB, with a SQL-fluent team and no multi-engine requirement, a warehouse is the answer — and the argument is complexity, not capability. The lakehouse is tempting because it sounds more modern and would technically work, but compaction, table maintenance and tuning are ongoing work a two-person team has no spare capacity for.'
    }
  ]
};
