// What the UI knows about each kind of connection. The server accepts exactly these types and fields (see API_CONTRACT.md).
export const TYPES = {
  postgres: { color: "blue", label: "PostgreSQL", mark: "Pg", noun: "table", nouns: "tables", blurb: "Tables in a PostgreSQL database",
    fields: [{ key: "url", label: "Connection URL", placeholder: "postgresql://user:password@host:5432/database…", required: true, secret: true }] },
  mongodb: { color: "green", label: "MongoDB", mark: "Mo", noun: "collection", nouns: "collections", blurb: "Collections in a MongoDB database",
    fields: [{ key: "url", label: "Connection URL", placeholder: "mongodb://host:27017…", required: true, secret: true }, { key: "database", label: "Database", placeholder: "openetl…", required: true }] },
  clickhouse: { color: "yellow", label: "ClickHouse", mark: "Ch", noun: "table", nouns: "tables", blurb: "Tables in a ClickHouse database over HTTP",
    fields: [{ key: "url", label: "HTTP URL", placeholder: "http://host:8123…", required: true }, { key: "user", label: "User", placeholder: "default…" }, { key: "password", label: "Password", secret: true }, { key: "database", label: "Database", placeholder: "default…", required: true }] },
  elasticsearch: { color: "teal", label: "Elasticsearch", mark: "Es", noun: "index", nouns: "indices", blurb: "Indices in an Elasticsearch cluster",
    fields: [{ key: "url", label: "URL", placeholder: "http://host:9200…", required: true }, { key: "apiKey", label: "API key (optional)", secret: true }] },
  qdrant: { color: "red", label: "Qdrant", mark: "Qd", noun: "collection", nouns: "collections", blurb: "Collections of points in Qdrant",
    fields: [{ key: "url", label: "URL", placeholder: "http://host:6333…", required: true }, { key: "apiKey", label: "API key (optional)", secret: true }] },
  relata: { color: "violet", label: "Relata", mark: "Rl", noun: "type", nouns: "types", blurb: "Typed records in a Relata server",
    fields: [{ key: "url", label: "URL", placeholder: "http://host:9090…", required: true }, { key: "token", label: "Token", secret: true, required: true }, { key: "types", label: "Types to list", placeholder: "DocumentChunk…" }] },
};
export const TYPE_IDS = Object.keys(TYPES);
export const typeOf = (t) => TYPES[t] || { color: "gray", label: t, mark: "?", noun: "item", nouns: "items", blurb: "", fields: [] };
