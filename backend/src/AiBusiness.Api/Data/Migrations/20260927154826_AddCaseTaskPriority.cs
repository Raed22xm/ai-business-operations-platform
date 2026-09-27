using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiBusiness.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCaseTaskPriority : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "CaseTasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Normal");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Priority",
                table: "CaseTasks");
        }
    }
}
