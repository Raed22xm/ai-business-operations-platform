using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiBusiness.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCaseArchivedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ArchivedAt",
                table: "Cases",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cases_ArchivedAt",
                table: "Cases",
                column: "ArchivedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Cases_ArchivedAt",
                table: "Cases");

            migrationBuilder.DropColumn(
                name: "ArchivedAt",
                table: "Cases");
        }
    }
}
