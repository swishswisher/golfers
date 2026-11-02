using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clubline.Api.Migrations
{
    /// <inheritdoc />
    public partial class DurableOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");
            migrationBuilder.Sql("ALTER TABLE \"Bookings\" ADD CONSTRAINT \"EX_Bookings_Overlap\" EXCLUDE USING gist (\"ClubId\" WITH =, \"ResourceId\" WITH =, tstzrange(\"StartsAt\", \"EndsAt\", '[)') WITH &&) WHERE (\"Status\" = 'Confirmed');");

            migrationBuilder.AddColumn<long>(
                name: "ProviderUpdatedAt",
                table: "Subscriptions",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Bookings\" DROP CONSTRAINT \"EX_Bookings_Overlap\";");
            migrationBuilder.DropColumn(
                name: "ProviderUpdatedAt",
                table: "Subscriptions");
        }
    }
}
