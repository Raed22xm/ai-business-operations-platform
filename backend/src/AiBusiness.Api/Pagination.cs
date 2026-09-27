using AiBusiness.Api.Models;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api;

public static class Pagination
{
    public const int DefaultPage = 1;
    public const int DefaultPageSize = 20;
    public const int MaximumPageSize = 100;

    public static bool TryResolve(
        int? page,
        int? pageSize,
        ModelStateDictionary modelState,
        out int resolvedPage,
        out int resolvedPageSize,
        out bool paginate)
    {
        resolvedPage = DefaultPage;
        resolvedPageSize = DefaultPageSize;
        paginate = page.HasValue || pageSize.HasValue;

        if (!paginate)
        {
            return true;
        }

        var pageValue = page ?? DefaultPage;
        var sizeValue = pageSize ?? DefaultPageSize;
        var valid = true;

        if (pageValue < 1)
        {
            modelState.AddModelError("page", "page must be at least 1.");
            valid = false;
        }

        if (sizeValue < 1)
        {
            modelState.AddModelError("pageSize", "pageSize must be at least 1.");
            valid = false;
        }
        else if (sizeValue > MaximumPageSize)
        {
            modelState.AddModelError(
                "pageSize",
                $"pageSize must be at most {MaximumPageSize}.");
            valid = false;
        }

        if (!valid)
        {
            return false;
        }

        resolvedPage = pageValue;
        resolvedPageSize = sizeValue;
        return true;
    }

    public static async Task<PagedResult<T>> ToPageAsync<T>(
        IQueryable<T> query,
        int page,
        int pageSize)
    {
        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToArrayAsync();

        return new PagedResult<T>
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
        };
    }
}
