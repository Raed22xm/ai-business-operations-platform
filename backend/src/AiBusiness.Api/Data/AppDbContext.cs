using AiBusiness.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AiBusiness.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
        SavingChanges += (_, _) => ApplyEntityRules();
    }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Case> Cases => Set<Case>();
    public DbSet<CaseTask> CaseTasks => Set<CaseTask>();
    public DbSet<CaseActivity> CaseActivities => Set<CaseActivity>();
    public DbSet<CustomerNote> CustomerNotes => Set<CustomerNote>();
    public DbSet<CaseTemplate> CaseTemplates => Set<CaseTemplate>();
    public DbSet<CaseTemplateTask> CaseTemplateTasks => Set<CaseTemplateTask>();

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
            work.Property(c => c.ArchivedAt);
            work.HasIndex(c => c.ArchivedAt);
            work.HasOne(c => c.Customer)
                .WithMany()
                .HasForeignKey(c => c.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CaseTask>(task =>
        {
            task.ToTable("CaseTasks");
            task.Property(t => t.Title).IsRequired().HasMaxLength(200);
            task.Property(t => t.Description);
            task.Property(t => t.DueDate);
            task.Property(t => t.Status)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(CaseTaskStatus.Todo);
            task.Property(t => t.Priority)
                .HasConversion<string>()
                .HasMaxLength(20)
                .HasDefaultValue(CaseTaskPriority.Normal);
            task.HasOne(t => t.Case)
                .WithMany()
                .HasForeignKey(t => t.CaseId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<CaseActivity>(activity =>
        {
            activity.ToTable("CaseActivities");
            activity.Property(a => a.EventType)
                .HasConversion<string>()
                .HasMaxLength(40)
                .IsRequired();
            activity.Property(a => a.Description)
                .IsRequired()
                .HasMaxLength(200);
            activity.Property(a => a.ActorName).HasMaxLength(200);
            activity.Property(a => a.OccurredAt).IsRequired();
            activity.HasIndex(a => new { a.CaseId, a.OccurredAt, a.Id });
            activity.HasOne(a => a.Case)
                .WithMany()
                .HasForeignKey(a => a.CaseId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomerNote>(note =>
        {
            note.ToTable("CustomerNotes");
            note.Property(n => n.Content)
                .IsRequired()
                .HasMaxLength(CustomerNote.MaxContentLength);
            note.Property(n => n.AuthorName)
                .IsRequired()
                .HasMaxLength(200);
            note.Property(n => n.CreatedAt).IsRequired();
            note.Property(n => n.UpdatedAt);
            note.HasIndex(n => new { n.CustomerId, n.CreatedAt, n.Id });
            note.HasOne(n => n.Customer)
                .WithMany()
                .HasForeignKey(n => n.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CaseTemplate>(template =>
        {
            template.ToTable("CaseTemplates");
            template.Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(CaseTemplate.MaxNameLength);
            template.Property(t => t.Description)
                .HasMaxLength(CaseTemplate.MaxDescriptionLength);
            template.Property(t => t.CreatedAt).IsRequired();
            template.HasMany(t => t.Tasks)
                .WithOne(task => task.Template!)
                .HasForeignKey(task => task.CaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CaseTemplateTask>(task =>
        {
            task.ToTable("CaseTemplateTasks");
            task.Property(t => t.Title)
                .IsRequired()
                .HasMaxLength(CaseTemplate.MaxTaskTitleLength);
            task.Property(t => t.SortOrder).IsRequired();
            task.HasIndex(t => new { t.CaseTemplateId, t.SortOrder });
        });
    }

    private void ApplyEntityRules()
    {
        foreach (var entry in ChangeTracker.Entries<Case>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = UtcNow();
                entry.Entity.ArchivedAt = null;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(c => c.CreatedAt).CurrentValue =
                    entry.Property(c => c.CreatedAt).OriginalValue;
                entry.Property(c => c.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CaseTask>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = UtcNow();
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(t => t.CreatedAt).CurrentValue =
                    entry.Property(t => t.CreatedAt).OriginalValue;
                entry.Property(t => t.CreatedAt).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CustomerNote>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = UtcNow();
                entry.Entity.UpdatedAt = null;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(n => n.CreatedAt).CurrentValue =
                    entry.Property(n => n.CreatedAt).OriginalValue;
                entry.Property(n => n.CreatedAt).IsModified = false;
                entry.Property(n => n.AuthorName).CurrentValue =
                    entry.Property(n => n.AuthorName).OriginalValue;
                entry.Property(n => n.AuthorName).IsModified = false;
                entry.Property(n => n.CustomerId).CurrentValue =
                    entry.Property(n => n.CustomerId).OriginalValue;
                entry.Property(n => n.CustomerId).IsModified = false;
            }
        }

        foreach (var entry in ChangeTracker.Entries<CaseTemplate>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = UtcNow();
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(t => t.CreatedAt).CurrentValue =
                    entry.Property(t => t.CreatedAt).OriginalValue;
                entry.Property(t => t.CreatedAt).IsModified = false;
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
