using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clubline.Api.Migrations
{
    /// <inheritdoc />
    public partial class RegistrationAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AttemptId",
                table: "Registrations",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "RegistrationAttemptId",
                table: "Payments",
                type: "uuid",
                nullable: true);
            migrationBuilder.Sql("UPDATE \"Payments\" p SET \"RegistrationAttemptId\" = r.\"AttemptId\" FROM \"Registrations\" r WHERE p.\"RegistrationId\" = r.\"Id\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttemptId",
                table: "Registrations");

            migrationBuilder.DropColumn(
                name: "RegistrationAttemptId",
                table: "Payments");
        }
    }
}
