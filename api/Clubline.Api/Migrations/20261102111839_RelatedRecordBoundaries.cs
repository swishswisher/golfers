using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Clubline.Api.Migrations
{
    /// <inheritdoc />
    public partial class RelatedRecordBoundaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Payments_ClubId_MemberId",
                table: "Payments",
                columns: new[] { "ClubId", "MemberId" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ClubId_RegistrationId",
                table: "Payments",
                columns: new[] { "ClubId", "RegistrationId" });

            migrationBuilder.CreateIndex(
                name: "IX_Files_ClubId_ConversationId",
                table: "Files",
                columns: new[] { "ClubId", "ConversationId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Files_Conversations_ClubId_ConversationId",
                table: "Files",
                columns: new[] { "ClubId", "ConversationId" },
                principalTable: "Conversations",
                principalColumns: new[] { "ClubId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Members_ClubId_MemberId",
                table: "Payments",
                columns: new[] { "ClubId", "MemberId" },
                principalTable: "Members",
                principalColumns: new[] { "ClubId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Registrations_ClubId_RegistrationId",
                table: "Payments",
                columns: new[] { "ClubId", "RegistrationId" },
                principalTable: "Registrations",
                principalColumns: new[] { "ClubId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Files_Conversations_ClubId_ConversationId",
                table: "Files");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Members_ClubId_MemberId",
                table: "Payments");

            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Registrations_ClubId_RegistrationId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ClubId_MemberId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_ClubId_RegistrationId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Files_ClubId_ConversationId",
                table: "Files");
        }
    }
}
