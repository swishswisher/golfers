using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clubline.Api.Migrations
{
    /// <inheritdoc />
    public partial class RecoverableSubscriptionCheckout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CheckoutExpiresAt",
                table: "Subscriptions",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckoutKey",
                table: "Subscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckoutPlan",
                table: "Subscriptions",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckoutUrl",
                table: "Subscriptions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckoutExpiresAt",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "CheckoutKey",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "CheckoutPlan",
                table: "Subscriptions");

            migrationBuilder.DropColumn(
                name: "CheckoutUrl",
                table: "Subscriptions");
        }
    }
}
