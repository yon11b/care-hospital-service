const cron = require("node-cron");
const models = require("../models");
const monitor = require("./detect_facility");

// 1분마다 실행
cron.schedule("*/1 * * * *", async () => {
  console.log("[Monitor] 탐지 시작:", new Date());

  try {
    const review = await monitor.detectReviewManipulationCron();
    if (review.length) console.log("[Alert] 리뷰 조작:", review);

    const facility = await monitor.detectFacilityEditCron();
    if (facility.length) console.log("[Alert] 시설 정보 조작:", facility);

    const ads = await monitor.detectAdFloodCron();
    if (ads.length) {
      console.log("[Action] 광고 제한:", ads);
      for (const ad of ads) {
        await models.ads.update(
          { status: "blocked" },
          { where: { id: ad.entity_id } }
        );
      }
    }

    // const reservation = await monitor.detectReservationAbuseCron();
    // if (reservation.length) {
    //   console.log("[Action] 예약 제한:", reservation);
    //   for (const r of reservation) {
    //     await models.staff.update(
    //       { restriction: true },
    //       { where: { id: r.user_id } }
    //     );
    //   }
    // }

    // const loginFails = await monitor.detectAbnormalLoginCron();
    // if (loginFails.length) {
    //   console.log("[Action] 계정 잠금:", loginFails);
    //   for (const u of loginFails) {
    //     await models.staff.update(
    //       { approval_status: "locked" },
    //       { where: { id: u.user_id } }
    //     );
    //   }
    // }

    //     const adminAbuse = await monitor.detectAdminAbuseCron();
    //     if (adminAbuse.length) console.log("[Alert] 관리자 이상행위:", adminAbuse);
  } catch (err) {
    console.error("[Monitor Error]", err);
  }
});
