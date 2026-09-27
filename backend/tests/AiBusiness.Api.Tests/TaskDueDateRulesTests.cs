using AiBusiness.Api.Models;
using AiBusiness.Api.Options;
using AiBusiness.Api.Services;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace AiBusiness.Api.Tests;

public class TaskDueDateRulesTests
{
    private static readonly DateOnly Today = new(2026, 9, 27);

    [Theory]
    [InlineData("2026-09-26", nameof(CaseTaskStatus.Todo), true)]
    [InlineData("2026-09-26", nameof(CaseTaskStatus.InProgress), true)]
    [InlineData("2026-09-27", nameof(CaseTaskStatus.Todo), false)]
    [InlineData("2026-09-28", nameof(CaseTaskStatus.Todo), false)]
    [InlineData("2026-09-26", nameof(CaseTaskStatus.Done), false)]
    [InlineData(null, nameof(CaseTaskStatus.Todo), false)]
    public void IsOverdue_MatchesRules(string? due, string statusName, bool expected)
    {
        DateOnly? dueDate = due is null ? null : DateOnly.Parse(due);
        var status = Enum.Parse<CaseTaskStatus>(statusName);

        Assert.Equal(expected, TaskDueDateRules.IsOverdue(dueDate, status, Today));
    }

    [Theory]
    [InlineData("2026-09-27", nameof(CaseTaskStatus.Todo), true)]
    [InlineData("2026-09-27", nameof(CaseTaskStatus.Done), false)]
    [InlineData("2026-09-26", nameof(CaseTaskStatus.Todo), false)]
    [InlineData(null, nameof(CaseTaskStatus.Todo), false)]
    public void IsDueToday_MatchesRules(string? due, string statusName, bool expected)
    {
        DateOnly? dueDate = due is null ? null : DateOnly.Parse(due);
        var status = Enum.Parse<CaseTaskStatus>(statusName);

        Assert.Equal(expected, TaskDueDateRules.IsDueToday(dueDate, status, Today));
    }

    [Fact]
    public void BusinessClock_UsesConfiguredTimezone_ForToday()
    {
        // 2026-01-15 23:30 UTC → 2026-01-16 00:30 in Europe/Copenhagen (UTC+1 winter).
        var options = MsOptions.Create(
            new BusinessTimezoneOptions { TimeZoneId = "Europe/Copenhagen" });
        var clock = new BusinessClock(
            options,
            () => new DateTimeOffset(2026, 1, 15, 23, 30, 0, TimeSpan.Zero));

        Assert.Equal(new DateOnly(2026, 1, 16), clock.Today);
        Assert.Equal("Europe/Copenhagen", clock.TimeZoneId);
    }

    [Fact]
    public void BusinessClock_BeforeMidnightUtc_StillPreviousDayInCopenhagen_WhenOffsetPositive()
    {
        // 2026-06-15 21:30 UTC → 2026-06-15 23:30 CEST (UTC+2) — still 15th.
        var options = MsOptions.Create(
            new BusinessTimezoneOptions { TimeZoneId = "Europe/Copenhagen" });
        var clock = new BusinessClock(
            options,
            () => new DateTimeOffset(2026, 6, 15, 21, 30, 0, TimeSpan.Zero));

        Assert.Equal(new DateOnly(2026, 6, 15), clock.Today);
    }

    [Fact]
    public void BusinessClock_CrossesIntoNextDay_InSummerTime()
    {
        // 2026-06-15 22:30 UTC → 2026-06-16 00:30 CEST (UTC+2).
        var options = MsOptions.Create(
            new BusinessTimezoneOptions { TimeZoneId = "Europe/Copenhagen" });
        var clock = new BusinessClock(
            options,
            () => new DateTimeOffset(2026, 6, 15, 22, 30, 0, TimeSpan.Zero));

        Assert.Equal(new DateOnly(2026, 6, 16), clock.Today);
    }
}
