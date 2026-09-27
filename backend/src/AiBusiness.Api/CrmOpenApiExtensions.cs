using AiBusiness.Api.Models;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace AiBusiness.Api;

/// <summary>
/// Enriches the generated OpenAPI document for CRM endpoints without changing runtime behavior.
/// </summary>
public static class CrmOpenApiExtensions
{
    public static OpenApiOptions AddCrmDocumentation(this OpenApiOptions options)
    {
        options.AddSchemaTransformer(TransformSchemaAsync);
        options.AddOperationTransformer(TransformOperationAsync);
        return options;
    }

    private static Task TransformSchemaAsync(
        OpenApiSchema schema,
        OpenApiSchemaTransformerContext context,
        CancellationToken cancellationToken)
    {
        var type = context.JsonTypeInfo.Type;

        if (type == typeof(Customer))
        {
            schema.Description =
                "Customer record. On create/update requests, `name` and `email` are required; "
                + "`phone` and `company` are optional. `id` and `createdAt` are server-controlled "
                + "(ignored on input, assigned or preserved by the API).";
            schema.Required ??= new HashSet<string>();
            schema.Required.Add("name");
            schema.Required.Add("email");
            DescribeProperty(schema, "id", "Server-assigned identifier. Ignored on create and update.");
            DescribeProperty(schema, "name", "Required. Non-blank display name.");
            DescribeProperty(schema, "email", "Required. Must be a valid email address.");
            DescribeProperty(schema, "phone", "Optional phone number. Null clears the value on update.");
            DescribeProperty(schema, "company", "Optional company name. Null clears the value on update.");
            DescribeProperty(schema, "createdAt", "UTC timestamp set by the server on create. Not changed by update.");
        }
        else if (type == typeof(Case))
        {
            schema.Description =
                "Support case. On create, `customerId` and `title` are required; `description` is optional. "
                + "`id`, `status`, and `createdAt` are server-controlled. Create always stores status `Open`.";
            schema.Required ??= new HashSet<string>();
            schema.Required.Add("customerId");
            schema.Required.Add("title");
            DescribeProperty(schema, "id", "Server-assigned identifier. Ignored on create.");
            DescribeProperty(schema, "customerId", "Required on create. Must reference an existing customer.");
            DescribeProperty(schema, "title", "Required. 1–200 characters after trim.");
            DescribeProperty(schema, "description", "Optional. Blank or whitespace is stored as null.");
            DescribeProperty(
                schema,
                "status",
                "One of Open, InProgress, Closed. Create always forces Open; clients cannot set status on create.");
            DescribeProperty(schema, "createdAt", "UTC timestamp set by the server on create.");
        }
        else if (type == typeof(CaseUpdate))
        {
            schema.Description =
                "Case update body. Only `title`, `description`, and `status` are applied. "
                + "`id`, `customerId`, and `createdAt` in the body are ignored. "
                + "`status` must be exactly Open, InProgress, or Closed (case-sensitive).";
            schema.Required ??= new HashSet<string>();
            schema.Required.Add("title");
            schema.Required.Add("status");
            DescribeProperty(schema, "id", "Ignored. The path `{id}` identifies the case.");
            DescribeProperty(schema, "customerId", "Ignored. Customer ownership cannot change.");
            DescribeProperty(schema, "title", "Required. 1–200 characters after trim.");
            DescribeProperty(schema, "description", "Optional. Blank or whitespace clears the description.");
            DescribeProperty(
                schema,
                "status",
                "Required. Exactly one of: Open, InProgress, Closed.");
            DescribeProperty(schema, "createdAt", "Ignored. Creation time cannot change.");
        }
        else if (type == typeof(CaseTask))
        {
            schema.Description =
                "Task within a case. On create, `caseId` and `title` are required; `description`, `dueDate`, and `priority` are optional. "
                + "`id`, `status`, and `createdAt` are server-controlled. Create always stores status `Todo`. "
                + "`priority` defaults to Normal when omitted.";
            schema.Required ??= new HashSet<string>();
            schema.Required.Add("caseId");
            schema.Required.Add("title");
            DescribeProperty(schema, "id", "Server-assigned identifier. Ignored on create.");
            DescribeProperty(schema, "caseId", "Required on create. Must reference an existing case.");
            DescribeProperty(schema, "title", "Required. 1–200 characters after trim.");
            DescribeProperty(schema, "description", "Optional. Blank or whitespace is stored as null.");
            DescribeProperty(schema, "dueDate", "Optional date without time (YYYY-MM-DD). Null clears on update.");
            DescribeProperty(
                schema,
                "status",
                "One of Todo, InProgress, Done. Create always forces Todo; clients cannot set status on create.");
            DescribeProperty(
                schema,
                "priority",
                "One of Low, Normal, High. Defaults to Normal when omitted on create.");
            DescribeProperty(schema, "createdAt", "UTC timestamp set by the server on create.");
        }
        else if (type == typeof(CaseTaskUpdate))
        {
            schema.Description =
                "Task update body. Only `title`, `description`, `dueDate`, `status`, and optionally `priority` are applied. "
                + "`id`, `caseId`, and `createdAt` in the body are ignored. "
                + "`status` must be exactly Todo, InProgress, or Done (case-sensitive). "
                + "When `priority` is omitted or null, the existing priority is preserved.";
            schema.Required ??= new HashSet<string>();
            schema.Required.Add("title");
            schema.Required.Add("status");
            DescribeProperty(schema, "id", "Ignored. The path `{id}` identifies the task.");
            DescribeProperty(schema, "caseId", "Ignored. Case ownership cannot change.");
            DescribeProperty(schema, "title", "Required. 1–200 characters after trim.");
            DescribeProperty(schema, "description", "Optional. Blank or whitespace clears the description.");
            DescribeProperty(schema, "dueDate", "Optional. Null clears the due date.");
            DescribeProperty(
                schema,
                "status",
                "Required. Exactly one of: Todo, InProgress, Done.");
            DescribeProperty(
                schema,
                "priority",
                "Optional. Exactly Low, Normal, or High when present. Omitted or null leaves the stored priority unchanged.");
            DescribeProperty(schema, "createdAt", "Ignored. Creation time cannot change.");
        }
        else if (type == typeof(CaseTaskStatus))
        {
            schema.Description = "Allowed values: Todo, InProgress, Done.";
        }
        else if (type == typeof(CaseTaskPriority))
        {
            schema.Description = "Allowed values: Low, Normal, High. Default Normal.";
        }
        else if (type == typeof(CaseStatus))
        {
            schema.Description = "Allowed values: Open, InProgress, Closed.";
        }
        else if (type == typeof(DashboardSummary))
        {
            schema.Description =
                "Dashboard totals calculated in the database. Overdue / due-today use BusinessTimezone "
                + "(default Europe/Copenhagen). Due dates are calendar dates. Empty tables yield zeros.";
            DescribeProperty(schema, "totalCustomers", "Number of customers.");
            DescribeProperty(schema, "totalCases", "Number of cases.");
            DescribeProperty(schema, "openCases", "Cases with status Open.");
            DescribeProperty(schema, "inProgressCases", "Cases with status InProgress.");
            DescribeProperty(schema, "closedCases", "Cases with status Closed.");
            DescribeProperty(schema, "overdueTasks", "Not-Done tasks with due date before business today.");
            DescribeProperty(schema, "dueTodayTasks", "Not-Done tasks due on business today.");
            DescribeProperty(
                schema,
                "outstandingTasks",
                "Compact list of not-Done tasks (earliest due first; max 8). Totals are not limited to this list.");
            DescribeProperty(schema, "businessTimeZone", "IANA zone used for today.");
            DescribeProperty(schema, "businessToday", "Calendar today in the business time zone (YYYY-MM-DD).");
        }
        else if (type == typeof(OutstandingTaskItem))
        {
            schema.Description = "Outstanding task row for the dashboard compact list.";
            DescribeProperty(schema, "caseId", "Parent case id (link target).");
            DescribeProperty(schema, "caseTitle", "Parent case title.");
            DescribeProperty(schema, "priority", "Task priority: Low, Normal, or High.");
            DescribeProperty(schema, "isOverdue", "True when due before business today and not Done.");
            DescribeProperty(schema, "isDueToday", "True when due on business today and not Done.");
        }
        else if (type == typeof(TaskSearchItem))
        {
            schema.Description = "Task row returned by GET /api/tasks/search.";
            DescribeProperty(schema, "priority", "Task priority: Low, Normal, or High.");
            DescribeProperty(schema, "isOverdue", "True when due before business today and not Done.");
            DescribeProperty(schema, "isDueToday", "True when due on business today and not Done.");
        }
        else if (type == typeof(CaseActivity))
        {
            schema.Description =
                "Product activity event for a case (not a tamper-proof audit log). "
                + "History starts when recording was enabled.";
            DescribeProperty(schema, "eventType", "CaseCreated, CaseEdited, CaseStatusChanged, TaskCreated, TaskUpdated, TaskCompleted, TaskDeleted.");
            DescribeProperty(schema, "description", "Short operator-facing summary.");
            DescribeProperty(schema, "occurredAt", "Server UTC timestamp.");
            DescribeProperty(schema, "actorName", "Authenticated display name when available; otherwise null.");
        }
        else if (IsPagedResult(type, out var itemName))
        {
            schema.Description =
                $"Paginated list returned when `page` and/or `pageSize` is provided. "
                + $"Contains `{itemName}` items plus page metadata.";
            DescribeProperty(schema, "items", "Items for the requested page (may be empty).");
            DescribeProperty(schema, "page", "1-based page number (default 1).");
            DescribeProperty(schema, "pageSize", "Page size (default 20, maximum 100).");
            DescribeProperty(schema, "totalCount", "Total matching rows before paging.");
        }
        else if (type == typeof(CaseSummaryResponse))
        {
            schema.Description =
                "Case summary for operator review. Factual fields are derived from saved case/customer/task data; "
                + "`suggestedNextAction` is a model suggestion. When OpenAI is not configured, `source` is `mock` "
                + "and `setupHint` explains how to set OpenAI:ApiKey.";
        }
        else if (type == typeof(DraftResponseResponse))
        {
            schema.Description =
                "Editable customer reply draft. Does not send messages. Uses OpenAI when configured, otherwise mock.";
        }
        else if (type == typeof(ResponseDraft))
        {
            schema.Description =
                "Saved response draft linked to a case. Supports Draft and Approved statuses, human review, and concurrency control.";
            DescribeProperty(schema, "id", "Server-assigned identifier.");
            DescribeProperty(schema, "caseId", "Parent case id.");
            DescribeProperty(schema, "content", "Draft reply text (max 10000 chars).");
            DescribeProperty(schema, "source", "Origin: Ai, Mock, or Manual.");
            DescribeProperty(schema, "status", "Draft or Approved.");
            DescribeProperty(schema, "createdBy", "Authenticated creator username.");
            DescribeProperty(schema, "createdAt", "Server UTC timestamp of creation.");
            DescribeProperty(schema, "updatedAt", "Server UTC timestamp of last edit, or null.");
            DescribeProperty(schema, "approvedBy", "Username who approved the exact text, or null.");
            DescribeProperty(schema, "approvedAt", "Server UTC timestamp of approval, or null.");
            DescribeProperty(schema, "version", "Concurrency token incremented on each update.");
        }
        else if (type == typeof(CreateResponseDraftRequest))
        {
            schema.Description = "Payload to save a new manual response draft.";
            DescribeProperty(schema, "content", "Draft customer reply text (1-10000 characters).");
        }
        else if (type == typeof(UpdateResponseDraftRequest))
        {
            schema.Description =
                "Payload to update an existing response draft. Editing an Approved draft reverts it to Draft.";
            DescribeProperty(schema, "content", "Updated draft text (1-10000 characters).");
            DescribeProperty(schema, "expectedVersion", "Current version of the draft for optimistic concurrency conflict detection.");
        }
        else if (type == typeof(ApproveResponseDraftRequest))
        {
            schema.Description =
                "Payload to approve an exact saved response draft. Approval applies strictly to saved text and never sends external messages.";
            DescribeProperty(schema, "approvedContent", "Exact saved text being approved (must match current draft content).");
            DescribeProperty(schema, "expectedVersion", "Current version of the draft for optimistic concurrency conflict detection.");
        }

        return Task.CompletedTask;
    }

    private static async Task TransformOperationAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        if (operation.Responses is null)
        {
            return;
        }

        if (IsCreateAction(context)
            && operation.Responses.TryGetValue("201", out var created)
            && created is OpenApiResponse createdResponse)
        {
            createdResponse.Headers ??= new Dictionary<string, IOpenApiHeader>();
            createdResponse.Headers["Location"] = new OpenApiHeader
            {
                Description =
                    "Absolute or relative URL of the created resource (CreatedAtAction location).",
                Schema = new OpenApiSchema { Type = JsonSchemaType.String },
            };
        }

        if (IsCustomerDelete(context)
            && operation.Responses.TryGetValue("409", out var conflict)
            && conflict is OpenApiResponse conflictResponse)
        {
            conflictResponse.Description ??=
                "Customer still has cases and cannot be deleted. Detail: "
                + "\"This customer has cases and cannot be deleted.\" Records are unchanged.";
        }

        if (IsCaseDelete(context)
            && operation.Responses.TryGetValue("409", out var caseConflict)
            && caseConflict is OpenApiResponse caseConflictResponse)
        {
            caseConflictResponse.Description ??=
                "Case still has tasks and cannot be deleted. Detail: "
                + "\"This case has tasks and cannot be deleted.\" Records are unchanged.";
        }

        if (TryGetListItemType(context, out var itemType)
            && operation.Responses.TryGetValue("200", out var ok)
            && ok is OpenApiResponse okResponse)
        {
            var arraySchema = await context.GetOrCreateSchemaAsync(
                itemType.MakeArrayType(),
                cancellationToken: cancellationToken);
            var pageSchema = await context.GetOrCreateSchemaAsync(
                typeof(PagedResult<>).MakeGenericType(itemType),
                cancellationToken: cancellationToken);

            okResponse.Description =
                "Without page/pageSize: JSON array. With page and/or pageSize: paginated object "
                + "({ items, page, pageSize, totalCount }).";
            okResponse.Content ??= new Dictionary<string, OpenApiMediaType>();
            okResponse.Content["application/json"] = new OpenApiMediaType
            {
                Schema = new OpenApiSchema
                {
                    OneOf = new List<IOpenApiSchema> { arraySchema, pageSchema },
                },
            };
        }
    }

    private static bool TryGetListItemType(OpenApiOperationTransformerContext context, out Type itemType)
    {
        itemType = typeof(object);
        var method = context.Description.HttpMethod;
        var path = context.Description.RelativePath ?? string.Empty;
        if (!string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (path.Equals("api/customers", StringComparison.OrdinalIgnoreCase))
        {
            itemType = typeof(Customer);
            return true;
        }

        if (path.Equals("api/cases", StringComparison.OrdinalIgnoreCase))
        {
            itemType = typeof(Case);
            return true;
        }

        return false;
    }

    private static bool IsCreateAction(OpenApiOperationTransformerContext context)
    {
        var method = context.Description.HttpMethod;
        var path = context.Description.RelativePath ?? string.Empty;
        return string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase)
            && (path.Equals("api/customers", StringComparison.OrdinalIgnoreCase)
                || path.Equals("api/cases", StringComparison.OrdinalIgnoreCase)
                || path.Equals("api/tasks", StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsCustomerDelete(OpenApiOperationTransformerContext context)
    {
        var method = context.Description.HttpMethod;
        var path = context.Description.RelativePath ?? string.Empty;
        return string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase)
            && path.Equals("api/customers/{id}", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsCaseDelete(OpenApiOperationTransformerContext context)
    {
        var method = context.Description.HttpMethod;
        var path = context.Description.RelativePath ?? string.Empty;
        return string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase)
            && path.Equals("api/cases/{id}", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsPagedResult(Type type, out string itemName)
    {
        itemName = "item";
        if (!type.IsGenericType || type.GetGenericTypeDefinition() != typeof(PagedResult<>))
        {
            return false;
        }

        itemName = type.GenericTypeArguments[0].Name;
        return true;
    }

    private static void DescribeProperty(OpenApiSchema schema, string name, string description)
    {
        if (schema.Properties is null)
        {
            return;
        }

        if (!schema.Properties.TryGetValue(name, out var property))
        {
            // System.Text.Json may emit camelCase keys already; try as-is then camelCase.
            var camel = char.ToLowerInvariant(name[0]) + name[1..];
            if (!schema.Properties.TryGetValue(camel, out property))
            {
                return;
            }

            name = camel;
        }

        if (property is OpenApiSchema concrete)
        {
            concrete.Description = description;
            schema.Properties[name] = concrete;
        }
    }
}
