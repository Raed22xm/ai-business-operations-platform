using AiBusiness.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
        SavingChanges += (_, _) => ApplyCaseRules();
    }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Case> Cases => Set<Case>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(customer =>
        {
            customer.Property(c => c.Name).IsRequired();
            customer.Property(c => c.Email).IsRequired();
        });

        modelBuilder.Entity<Case>(work =>
        {
            work.Property(c => c.Title).IsRequired().HasMaxLength(200);
            work.Property(c => c.Description);
            work.Property(c => c.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(CaseStatus.Open);
            work.HasOne(c => c.Customer)
                .WithMany()
                .HasForeignKey(c => c.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private void ApplyCaseRules()
    {
        foreach (var entry in ChangeTracker.Entries<Case>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = UtcNow();
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(c => c.CreatedAt).CurrentValue =
                    entry.Property(c => c.CreatedAt).OriginalValue;
                entry.Property(c => c.CreatedAt).IsModified = false;
            }
        }
    }

    // PostgreSQL stores timestamps to the microsecond. Trim the extra .NET precision
    // so a value read back from the database still matches the value we saved.
    private static DateTime UtcNow()
    {
        var now = DateTime.UtcNow;
        var ticks = now.Ticks - (now.Ticks % TimeSpan.TicksPerMicrosecond);
        return new DateTime(ticks, DateTimeKind.Utc);
    }
}
