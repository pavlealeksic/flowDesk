//! Advanced query processing with field searches, filters, facets, and complex expressions

use crate::search::{
    SearchQuery, SearchResult as SearchResultType, SearchError, 
    ErrorContext, SearchErrorContext, ContentType, ProviderType
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, BTreeMap};
use tantivy::{
    collector::{FacetCollector, TopDocs},
    query::{BooleanQuery, TermQuery, RangeQuery, FuzzyTermQuery, PhraseQuery, Query, QueryParser},
    schema::{Field, Schema, Value, FieldType},
    Term, TantivyDocument, DocAddress, Score,
};
use chrono::{DateTime, Utc};
use tracing::{debug, warn, error, instrument};

/// Advanced query builder for complex search operations
pub struct AdvancedQueryBuilder {
    /// Tantivy schema
    schema: Schema,
    
    /// Field mappings
    fields: FieldMappings,
    
    /// Query parser
    query_parser: QueryParser,
    
    /// Facet configuration
    facet_config: FacetConfiguration,
}

/// Field mappings for search operations
#[derive(Debug, Clone)]
pub struct FieldMappings {
    /// Title field
    pub title: Field,
    
    /// Content field
    pub content: Field,
    
    /// Summary field
    pub summary: Field,
    
    /// Content type field
    pub content_type: Field,
    
    /// Provider ID field
    pub provider_id: Field,
    
    /// Provider type field
    pub provider_type: Field,
    
    /// Author field
    pub author: Field,
    
    /// Created date field
    pub created_at: Field,
    
    /// Modified date field
    pub last_modified: Field,
    
    /// URL field
    pub url: Field,
    
    /// Tags field
    pub tags: Field,
    
    /// Categories field
    pub categories: Field,
    
    /// Custom metadata fields
    pub metadata_fields: HashMap<String, Field>,
    
    /// Facet fields
    pub facet_fields: HashMap<String, Field>,
}

/// Advanced search filters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedFilters {
    /// Content type filters
    pub content_types: Option<Vec<ContentType>>,
    
    /// Provider filters
    pub providers: Option<Vec<String>>,
    
    /// Provider type filters
    pub provider_types: Option<Vec<ProviderType>>,
    
    /// Date range filter
    pub date_range: Option<DateRangeFilter>,
    
    /// Author filter
    pub authors: Option<Vec<String>>,
    
    /// Tag filters
    pub tags: Option<TagFilter>,
    
    /// Category filters
    pub categories: Option<Vec<String>>,
    
    /// File size filter (for files)
    pub file_size_range: Option<SizeRangeFilter>,
    
    /// Custom metadata filters
    pub metadata_filters: Option<HashMap<String, MetadataFilter>>,
    
    /// Geo-location filter
    pub location_filter: Option<LocationFilter>,
    
    /// Language filter
    pub language: Option<String>,
    
    /// Priority filter
    pub priority_range: Option<PriorityRangeFilter>,
}

/// Date range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRangeFilter {
    /// Start date (inclusive)
    pub start: Option<DateTime<Utc>>,
    
    /// End date (inclusive)
    pub end: Option<DateTime<Utc>>,
    
    /// Relative date expressions
    pub relative: Option<RelativeDateFilter>,
    
    /// Date field to filter on
    pub field: DateField,
}

/// Date fields for filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DateField {
    CreatedAt,
    LastModified,
    DueDate,
    StartDate,
    EndDate,
}

/// Relative date filters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelativeDateFilter {
    Today,
    Yesterday,
    ThisWeek,
    LastWeek,
    ThisMonth,
    LastMonth,
    ThisYear,
    LastYear,
    Last24Hours,
    Last7Days,
    Last30Days,
}

/// Tag filter with include/exclude logic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagFilter {
    /// Tags that must be present (AND logic)
    pub include_all: Option<Vec<String>>,
    
    /// Tags where at least one must be present (OR logic)
    pub include_any: Option<Vec<String>>,
    
    /// Tags that must not be present
    pub exclude: Option<Vec<String>>,
}

/// File size range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeRangeFilter {
    /// Minimum size in bytes
    pub min_size: Option<u64>,
    
    /// Maximum size in bytes
    pub max_size: Option<u64>,
    
    /// Size units for display
    pub unit: SizeUnit,
}

/// Size units
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SizeUnit {
    Bytes,
    KB,
    MB,
    GB,
}

/// Metadata filter for custom fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataFilter {
    /// Field name
    pub field: String,
    
    /// Filter operation
    pub operation: FilterOperation,
    
    /// Filter value
    pub value: FilterValue,
}

/// Filter operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperation {
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    InRange,
    IsEmpty,
    IsNotEmpty,
}

/// Filter value types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FilterValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<String>),
    Range { min: f64, max: f64 },
}

/// Location-based filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationFilter {
    /// Center point latitude
    pub latitude: f64,
    
    /// Center point longitude
    pub longitude: f64,
    
    /// Radius in kilometers
    pub radius_km: f64,
    
    /// Location field name
    pub field: String,
}

/// Priority range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityRangeFilter {
    /// Minimum priority (1-5)
    pub min_priority: Option<u8>,
    
    /// Maximum priority (1-5)
    pub max_priority: Option<u8>,
}

/// Field-specific search query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldQuery {
    /// Field name
    pub field: String,
    
    /// Query text
    pub query: String,
    
    /// Query type
    pub query_type: FieldQueryType,
    
    /// Boost factor for relevance
    pub boost: Option<f32>,
}

/// Types of field queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldQueryType {
    /// Exact term match
    Term,
    
    /// Phrase match
    Phrase,
    
    /// Fuzzy match (with typo tolerance)
    Fuzzy,
    
    /// Prefix match
    Prefix,
    
    /// Wildcard match
    Wildcard,
    
    /// Regular expression
    Regex,
    
    /// Full-text search
    FullText,
}

/// Facet configuration
#[derive(Debug, Clone)]
pub struct FacetConfiguration {
    /// Enabled facet fields
    pub enabled_facets: HashMap<String, FacetConfig>,
    
    /// Maximum facet values per field
    pub max_facet_values: usize,
    
    /// Minimum document count for facet values
    pub min_facet_count: usize,
}

/// Individual facet configuration
#[derive(Debug, Clone)]
pub struct FacetConfig {
    /// Field name
    pub field: String,
    
    /// Display name
    pub display_name: String,
    
    /// Facet type
    pub facet_type: FacetType,
    
    /// Sort order for facet values
    pub sort_order: FacetSortOrder,
    
    /// Maximum values to return
    pub max_values: usize,
    
    /// Hierarchical facet configuration
    pub hierarchical: Option<HierarchicalFacetConfig>,
}

/// Facet types
#[derive(Debug, Clone)]
pub enum FacetType {
    /// Terms facet (categorical)
    Terms,
    
    /// Range facet (numeric/date ranges)
    Range,
    
    /// Hierarchical facet
    Hierarchical,
    
    /// Date histogram
    DateHistogram,
    
    /// Numeric histogram
    NumericHistogram,
}

/// Facet value sorting
#[derive(Debug, Clone)]
pub enum FacetSortOrder {
    CountDescending,
    CountAscending,
    KeyDescending,
    KeyAscending,
}

/// Hierarchical facet configuration
#[derive(Debug, Clone)]
pub struct HierarchicalFacetConfig {
    /// Hierarchy levels
    pub levels: Vec<String>,
    
    /// Separator character
    pub separator: String,
    
    /// Maximum depth to expand
    pub max_depth: usize,
}

/// Search result facets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacets {
    /// Facet results by field name
    pub facets: HashMap<String, Vec<FacetValue>>,
    
    /// Total document count for facets
    pub total_count: u64,
}

/// Individual facet value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FacetValue {
    /// Facet value
    pub value: String,
    
    /// Document count for this value
    pub count: u64,
    
    /// Display name (may differ from value)
    pub display_name: Option<String>,
    
    /// Whether this facet is selected/active
    pub selected: bool,
    
    /// Child facet values (for hierarchical facets)
    pub children: Option<Vec<FacetValue>>,
}

/// Advanced query expression
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryExpression {
    /// Main query text
    pub query: String,
    
    /// Field-specific queries
    pub field_queries: Option<Vec<FieldQuery>>,
    
    /// Boolean query logic
    pub boolean_logic: Option<BooleanQueryLogic>,
    
    /// Filters to apply
    pub filters: Option<AdvancedFilters>,
    
    /// Facets to compute
    pub facets: Option<Vec<String>>,
    
    /// Sorting configuration
    pub sort: Option<Vec<SortConfig>>,
    
    /// Highlighting configuration
    pub highlight: Option<HighlightConfig>,
}

/// Boolean query logic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BooleanQueryLogic {
    /// Must match clauses (AND)
    pub must: Option<Vec<QueryClause>>,
    
    /// Should match clauses (OR)
    pub should: Option<Vec<QueryClause>>,
    
    /// Must not match clauses (NOT)
    pub must_not: Option<Vec<QueryClause>>,
    
    /// Filter clauses (don't affect scoring)
    pub filter: Option<Vec<QueryClause>>,
    
    /// Minimum should match
    pub minimum_should_match: Option<u32>,
}

/// Individual query clause
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryClause {
    /// Query type
    pub query_type: QueryClauseType,
    
    /// Field name
    pub field: Option<String>,
    
    /// Query value
    pub value: String,
    
    /// Boost factor
    pub boost: Option<f32>,
}

/// Types of query clauses
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueryClauseType {
    Match,
    Term,
    Phrase,
    Prefix,
    Wildcard,
    Fuzzy,
    Range,
    Exists,
}

/// Sort configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortConfig {
    /// Field to sort by
    pub field: String,
    
    /// Sort order
    pub order: SortOrder,
    
    /// Missing value handling
    pub missing: Option<SortMissingValue>,
}

/// Sort orders
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

/// Missing value handling for sorting
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SortMissingValue {
    First,
    Last,
    Custom(String),
}

/// Highlighting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightConfig {
    /// Fields to highlight
    pub fields: Vec<String>,
    
    /// Fragment size
    pub fragment_size: usize,
    
    /// Number of fragments
    pub number_of_fragments: usize,
    
    /// Pre-tag for highlights
    pub pre_tags: Vec<String>,
    
    /// Post-tag for highlights
    pub post_tags: Vec<String>,
    
    /// Highlight entire field if no fragments
    pub highlight_entire_field: bool,
}

impl AdvancedQueryBuilder {
    /// Create new advanced query builder
    pub fn new(schema: Schema) -> SearchResultType<Self> {
        let fields = Self::extract_field_mappings(&schema)?;
        let query_parser = QueryParser::for_index(
            &tantivy::Index::create_in_ram(schema.clone()),
            vec![fields.title, fields.content, fields.summary],
        );
        
        let facet_config = FacetConfiguration {
            enabled_facets: Self::default_facet_config(&fields),
            max_facet_values: 20,
            min_facet_count: 1,
        };
        
        Ok(Self {
            schema,
            fields,
            query_parser,
            facet_config,
        })
    }
    
    /// Build advanced query from expression
    #[instrument(skip(self, expression), fields(query = %expression.query))]
    pub fn build_query(&self, expression: &QueryExpression) -> SearchResultType<Box<dyn Query>> {
        debug!("Building advanced query: {}", expression.query);
        
        let mut boolean_query = BooleanQuery::new(vec![]);
        
        // Parse main query
        if !expression.query.is_empty() {
            match self.query_parser.parse_query(&expression.query) {
                Ok(query) => {
                    boolean_query.add_clause(tantivy::query::Occur::Must, query);
                }
                Err(e) => {
                    return Err(SearchError::query_parsing_error(
                        format!("Failed to parse main query: {}", e)
                    ));
                }
            }
        }
        
        // Add field-specific queries
        if let Some(field_queries) = &expression.field_queries {
            for field_query in field_queries {
                let query = self.build_field_query(field_query)?;
                boolean_query.add_clause(tantivy::query::Occur::Must, query);
            }
        }
        
        // Add boolean logic queries
        if let Some(boolean_logic) = &expression.boolean_logic {
            self.apply_boolean_logic(&mut boolean_query, boolean_logic)?;
        }
        
        // Add filter queries
        if let Some(filters) = &expression.filters {
            let filter_query = self.build_filter_query(filters)?;
            boolean_query.add_clause(tantivy::query::Occur::Filter, filter_query);
        }
        
        Ok(Box::new(boolean_query))
    }
    
    /// Build field-specific query
    fn build_field_query(&self, field_query: &FieldQuery) -> SearchResultType<Box<dyn Query>> {
        let field = self.get_field_by_name(&field_query.field)
            .ok_or_else(|| SearchError::invalid_field(&field_query.field))?;
        
        let query: Box<dyn Query> = match field_query.query_type {
            FieldQueryType::Term => {
                let term = Term::from_field_text(field, &field_query.query);
                Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic))
            }
            FieldQueryType::Phrase => {
                let terms: Vec<Term> = field_query.query
                    .split_whitespace()
                    .map(|word| Term::from_field_text(field, word))
                    .collect();
                Box::new(PhraseQuery::new(terms))
            }
            FieldQueryType::Fuzzy => {
                let term = Term::from_field_text(field, &field_query.query);
                Box::new(FuzzyTermQuery::new(term, 2, true)) // Max 2 edits, transpositions allowed
            }
            FieldQueryType::FullText => {
                // Use query parser for full-text search on specific field
                let field_parser = QueryParser::for_index(
                    &tantivy::Index::create_in_ram(self.schema.clone()),
                    vec![field],
                );
                match field_parser.parse_query(&field_query.query) {
                    Ok(query) => query,
                    Err(e) => {
                        return Err(SearchError::query_parsing_error(
                            format!("Failed to parse field query: {}", e)
                        ));
                    }
                }
            }
            _ => {
                warn!("Unsupported field query type: {:?}", field_query.query_type);
                let term = Term::from_field_text(field, &field_query.query);
                Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic))
            }
        };
        
        Ok(query)
    }
    
    /// Apply boolean logic to query
    fn apply_boolean_logic(
        &self,
        boolean_query: &mut BooleanQuery,
        logic: &BooleanQueryLogic,
    ) -> SearchResultType<()> {
        // Add MUST clauses
        if let Some(must_clauses) = &logic.must {
            for clause in must_clauses {
                let query = self.build_query_clause(clause)?;
                boolean_query.add_clause(tantivy::query::Occur::Must, query);
            }
        }
        
        // Add SHOULD clauses
        if let Some(should_clauses) = &logic.should {
            for clause in should_clauses {
                let query = self.build_query_clause(clause)?;
                boolean_query.add_clause(tantivy::query::Occur::Should, query);
            }
        }
        
        // Add MUST_NOT clauses
        if let Some(must_not_clauses) = &logic.must_not {
            for clause in must_not_clauses {
                let query = self.build_query_clause(clause)?;
                boolean_query.add_clause(tantivy::query::Occur::MustNot, query);
            }
        }
        
        // Add FILTER clauses
        if let Some(filter_clauses) = &logic.filter {
            for clause in filter_clauses {
                let query = self.build_query_clause(clause)?;
                boolean_query.add_clause(tantivy::query::Occur::Filter, query);
            }
        }
        
        Ok(())
    }
    
    /// Build individual query clause
    fn build_query_clause(&self, clause: &QueryClause) -> SearchResultType<Box<dyn Query>> {
        let field = if let Some(field_name) = &clause.field {
            self.get_field_by_name(field_name)
                .ok_or_else(|| SearchError::invalid_field(field_name))?
        } else {
            self.fields.content // Default to content field
        };
        
        let query: Box<dyn Query> = match clause.query_type {
            QueryClauseType::Match => {
                match self.query_parser.parse_query(&clause.value) {
                    Ok(query) => query,
                    Err(e) => {
                        return Err(SearchError::query_parsing_error(
                            format!("Failed to parse match clause: {}", e)
                        ));
                    }
                }
            }
            QueryClauseType::Term => {
                let term = Term::from_field_text(field, &clause.value);
                Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic))
            }
            QueryClauseType::Phrase => {
                let terms: Vec<Term> = clause.value
                    .split_whitespace()
                    .map(|word| Term::from_field_text(field, word))
                    .collect();
                Box::new(PhraseQuery::new(terms))
            }
            QueryClauseType::Fuzzy => {
                let term = Term::from_field_text(field, &clause.value);
                Box::new(FuzzyTermQuery::new(term, 2, true))
            }
            _ => {
                warn!("Unsupported query clause type: {:?}", clause.query_type);
                let term = Term::from_field_text(field, &clause.value);
                Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic))
            }
        };
        
        Ok(query)
    }
    
    /// Build filter query from advanced filters
    fn build_filter_query(&self, filters: &AdvancedFilters) -> SearchResultType<Box<dyn Query>> {
        let mut filter_queries = vec![];
        
        // Content type filters
        if let Some(content_types) = &filters.content_types {
            let mut content_type_queries = vec![];
            for content_type in content_types {
                let term = Term::from_field_text(self.fields.content_type, &content_type.to_string());
                content_type_queries.push((
                    tantivy::query::Occur::Should,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
            if !content_type_queries.is_empty() {
                filter_queries.push((
                    tantivy::query::Occur::Must,
                    Box::new(BooleanQuery::new(content_type_queries)) as Box<dyn Query>
                ));
            }
        }
        
        // Provider filters
        if let Some(providers) = &filters.providers {
            let mut provider_queries = vec![];
            for provider in providers {
                let term = Term::from_field_text(self.fields.provider_id, provider);
                provider_queries.push((
                    tantivy::query::Occur::Should,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
            if !provider_queries.is_empty() {
                filter_queries.push((
                    tantivy::query::Occur::Must,
                    Box::new(BooleanQuery::new(provider_queries)) as Box<dyn Query>
                ));
            }
        }
        
        // Date range filters
        if let Some(date_range) = &filters.date_range {
            let date_query = self.build_date_range_query(date_range)?;
            filter_queries.push((tantivy::query::Occur::Must, date_query));
        }
        
        // Author filters
        if let Some(authors) = &filters.authors {
            let mut author_queries = vec![];
            for author in authors {
                let term = Term::from_field_text(self.fields.author, author);
                author_queries.push((
                    tantivy::query::Occur::Should,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
            if !author_queries.is_empty() {
                filter_queries.push((
                    tantivy::query::Occur::Must,
                    Box::new(BooleanQuery::new(author_queries)) as Box<dyn Query>
                ));
            }
        }
        
        // Tag filters
        if let Some(tag_filter) = &filters.tags {
            let tag_query = self.build_tag_filter_query(tag_filter)?;
            filter_queries.push((tantivy::query::Occur::Must, tag_query));
        }
        
        Ok(Box::new(BooleanQuery::new(filter_queries)))
    }
    
    /// Build date range query
    fn build_date_range_query(&self, date_range: &DateRangeFilter) -> SearchResultType<Box<dyn Query>> {
        let field = match date_range.field {
            DateField::CreatedAt => self.fields.created_at,
            DateField::LastModified => self.fields.last_modified,
            _ => self.fields.last_modified, // Default fallback
        };
        
        let (start_date, end_date) = if let Some(relative) = &date_range.relative {
            self.resolve_relative_date(relative)
        } else {
            (date_range.start, date_range.end)
        };
        
        // Convert dates to Tantivy date values
        let start_value = start_date.map(|d| tantivy::DateTime::from_timestamp_secs(d.timestamp()));
        let end_value = end_date.map(|d| tantivy::DateTime::from_timestamp_secs(d.timestamp()));
        
        let range_query = RangeQuery::new_date_bounds(
            field,
            tantivy::query::Bound::Included(start_value.unwrap_or(tantivy::DateTime::MIN)),
            tantivy::query::Bound::Included(end_value.unwrap_or(tantivy::DateTime::MAX)),
        );
        
        Ok(Box::new(range_query))
    }
    
    /// Build tag filter query with include/exclude logic
    fn build_tag_filter_query(&self, tag_filter: &TagFilter) -> SearchResultType<Box<dyn Query>> {
        let mut tag_queries = vec![];
        
        // Include all tags (AND logic)
        if let Some(include_all) = &tag_filter.include_all {
            for tag in include_all {
                let term = Term::from_field_text(self.fields.tags, tag);
                tag_queries.push((
                    tantivy::query::Occur::Must,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
        }
        
        // Include any tags (OR logic)
        if let Some(include_any) = &tag_filter.include_any {
            let mut any_queries = vec![];
            for tag in include_any {
                let term = Term::from_field_text(self.fields.tags, tag);
                any_queries.push((
                    tantivy::query::Occur::Should,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
            if !any_queries.is_empty() {
                tag_queries.push((
                    tantivy::query::Occur::Must,
                    Box::new(BooleanQuery::new(any_queries)) as Box<dyn Query>
                ));
            }
        }
        
        // Exclude tags
        if let Some(exclude) = &tag_filter.exclude {
            for tag in exclude {
                let term = Term::from_field_text(self.fields.tags, tag);
                tag_queries.push((
                    tantivy::query::Occur::MustNot,
                    Box::new(TermQuery::new(term, tantivy::schema::IndexRecordOption::Basic)) as Box<dyn Query>
                ));
            }
        }
        
        Ok(Box::new(BooleanQuery::new(tag_queries)))
    }
    
    /// Resolve relative date to absolute dates
    fn resolve_relative_date(&self, relative: &RelativeDateFilter) -> (Option<DateTime<Utc>>, Option<DateTime<Utc>>) {
        let now = Utc::now();
        
        match relative {
            RelativeDateFilter::Today => {
                let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
                let end = now.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();
                (Some(start), Some(end))
            }
            RelativeDateFilter::Yesterday => {
                let yesterday = now - chrono::Duration::days(1);
                let start = yesterday.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
                let end = yesterday.date_naive().and_hms_opt(23, 59, 59).unwrap().and_utc();
                (Some(start), Some(end))
            }
            RelativeDateFilter::ThisWeek => {
                let days_since_monday = now.weekday().num_days_from_monday();
                let start = now - chrono::Duration::days(days_since_monday as i64);
                let start = start.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
                (Some(start), Some(now))
            }
            RelativeDateFilter::LastWeek => {
                let days_since_monday = now.weekday().num_days_from_monday();
                let this_monday = now - chrono::Duration::days(days_since_monday as i64);
                let last_monday = this_monday - chrono::Duration::days(7);
                let last_sunday = this_monday - chrono::Duration::seconds(1);
                let start = last_monday.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
                (Some(start), Some(last_sunday))
            }
            RelativeDateFilter::Last24Hours => {
                let start = now - chrono::Duration::hours(24);
                (Some(start), Some(now))
            }
            RelativeDateFilter::Last7Days => {
                let start = now - chrono::Duration::days(7);
                (Some(start), Some(now))
            }
            RelativeDateFilter::Last30Days => {
                let start = now - chrono::Duration::days(30);
                (Some(start), Some(now))
            }
            RelativeDateFilter::ThisMonth => {
                let start = now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();
                (Some(start), Some(now))
            }
            RelativeDateFilter::LastMonth => {
                let first_of_month = now.date_naive().with_day(1).unwrap();
                let first_of_last_month = if first_of_month.month() == 1 {
                    chrono::NaiveDate::from_ymd_opt(first_of_month.year() - 1, 12, 1).unwrap()
                } else {
                    chrono::NaiveDate::from_ymd_opt(first_of_month.year(), first_of_month.month() - 1, 1).unwrap()
                };
                let start = first_of_last_month.and_hms_opt(0, 0, 0).unwrap().and_utc();
                let end = (first_of_month - chrono::Duration::seconds(1)).and_hms_opt(23, 59, 59).unwrap().and_utc();
                (Some(start), Some(end))
            }
            RelativeDateFilter::ThisYear => {
                let start = chrono::NaiveDate::from_ymd_opt(now.year(), 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();
                (Some(start), Some(now))
            }
            RelativeDateFilter::LastYear => {
                let start = chrono::NaiveDate::from_ymd_opt(now.year() - 1, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();
                let end = chrono::NaiveDate::from_ymd_opt(now.year() - 1, 12, 31).unwrap().and_hms_opt(23, 59, 59).unwrap().and_utc();
                (Some(start), Some(end))
            }
        }
    }
    
    /// Get field by name
    fn get_field_by_name(&self, field_name: &str) -> Option<Field> {
        match field_name {
            "title" => Some(self.fields.title),
            "content" => Some(self.fields.content),
            "summary" => Some(self.fields.summary),
            "author" => Some(self.fields.author),
            "content_type" => Some(self.fields.content_type),
            "provider_id" => Some(self.fields.provider_id),
            "provider_type" => Some(self.fields.provider_type),
            "created_at" => Some(self.fields.created_at),
            "last_modified" => Some(self.fields.last_modified),
            "url" => Some(self.fields.url),
            "tags" => Some(self.fields.tags),
            "categories" => Some(self.fields.categories),
            _ => self.fields.metadata_fields.get(field_name).cloned(),
        }
    }
    
    /// Extract field mappings from schema
    fn extract_field_mappings(schema: &Schema) -> SearchResultType<FieldMappings> {
        // This would extract actual field mappings from the Tantivy schema
        // For now, return mock field mappings
        Ok(FieldMappings {
            title: Field::from_field_id(0),
            content: Field::from_field_id(1),
            summary: Field::from_field_id(2),
            content_type: Field::from_field_id(3),
            provider_id: Field::from_field_id(4),
            provider_type: Field::from_field_id(5),
            author: Field::from_field_id(6),
            created_at: Field::from_field_id(7),
            last_modified: Field::from_field_id(8),
            url: Field::from_field_id(9),
            tags: Field::from_field_id(10),
            categories: Field::from_field_id(11),
            metadata_fields: HashMap::new(),
            facet_fields: HashMap::new(),
        })
    }
    
    /// Default facet configuration
    fn default_facet_config(fields: &FieldMappings) -> HashMap<String, FacetConfig> {
        let mut facets = HashMap::new();
        
        facets.insert("content_type".to_string(), FacetConfig {
            field: "content_type".to_string(),
            display_name: "Content Type".to_string(),
            facet_type: FacetType::Terms,
            sort_order: FacetSortOrder::CountDescending,
            max_values: 20,
            hierarchical: None,
        });
        
        facets.insert("provider".to_string(), FacetConfig {
            field: "provider_id".to_string(),
            display_name: "Provider".to_string(),
            facet_type: FacetType::Terms,
            sort_order: FacetSortOrder::CountDescending,
            max_values: 20,
            hierarchical: None,
        });
        
        facets.insert("author".to_string(), FacetConfig {
            field: "author".to_string(),
            display_name: "Author".to_string(),
            facet_type: FacetType::Terms,
            sort_order: FacetSortOrder::CountDescending,
            max_values: 15,
            hierarchical: None,
        });
        
        facets.insert("tags".to_string(), FacetConfig {
            field: "tags".to_string(),
            display_name: "Tags".to_string(),
            facet_type: FacetType::Terms,
            sort_order: FacetSortOrder::CountDescending,
            max_values: 25,
            hierarchical: None,
        });
        
        facets
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tantivy::{schema::SchemaBuilder, Index};
    
    #[test]
    fn test_query_expression_building() {
        let mut schema_builder = SchemaBuilder::default();
        let title = schema_builder.add_text_field("title", tantivy::schema::TEXT | tantivy::schema::STORED);
        let content = schema_builder.add_text_field("content", tantivy::schema::TEXT);
        let schema = schema_builder.build();
        
        let builder = AdvancedQueryBuilder::new(schema).unwrap();
        
        let expression = QueryExpression {
            query: "test query".to_string(),
            field_queries: Some(vec![
                FieldQuery {
                    field: "title".to_string(),
                    query: "important".to_string(),
                    query_type: FieldQueryType::Term,
                    boost: Some(2.0),
                }
            ]),
            boolean_logic: None,
            filters: None,
            facets: None,
            sort: None,
            highlight: None,
        };
        
        let query = builder.build_query(&expression);
        assert!(query.is_ok());
    }
    
    #[test]
    fn test_date_range_resolution() {
        let mut schema_builder = SchemaBuilder::default();
        let schema = schema_builder.build();
        let builder = AdvancedQueryBuilder::new(schema).unwrap();
        
        let (start, end) = builder.resolve_relative_date(&RelativeDateFilter::Today);
        assert!(start.is_some());
        assert!(end.is_some());
        
        let (start, end) = builder.resolve_relative_date(&RelativeDateFilter::Last7Days);
        assert!(start.is_some());
        assert!(end.is_some());
        assert!(end.unwrap() > start.unwrap());
    }
    
    #[test]
    fn test_filter_building() {
        let mut schema_builder = SchemaBuilder::default();
        let schema = schema_builder.build();
        let builder = AdvancedQueryBuilder::new(schema).unwrap();
        
        let filters = AdvancedFilters {
            content_types: Some(vec![ContentType::Email, ContentType::Document]),
            providers: Some(vec!["gmail".to_string(), "slack".to_string()]),
            date_range: Some(DateRangeFilter {
                start: None,
                end: None,
                relative: Some(RelativeDateFilter::Last7Days),
                field: DateField::LastModified,
            }),
            authors: None,
            tags: Some(TagFilter {
                include_all: Some(vec!["urgent".to_string()]),
                include_any: Some(vec!["project".to_string(), "meeting".to_string()]),
                exclude: Some(vec!["spam".to_string()]),
            }),
            categories: None,
            file_size_range: None,
            metadata_filters: None,
            location_filter: None,
            language: None,
            priority_range: None,
            provider_types: None,
        };
        
        let filter_query = builder.build_filter_query(&filters);
        assert!(filter_query.is_ok());
    }
}