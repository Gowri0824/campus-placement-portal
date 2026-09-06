import { useEffect, useState } from "react";

import DashboardCard from "../../components/admin/DashboardCard";
import Statistics from "../../components/admin/Statistics";
import { APPLICATION_STATUS } from "../../constants/applicationStatuses";

import { supabase } from "../../services/supabaseClient";


function AdminDashboard() {

    const [stats, setStats] = useState({
        students: 0,
        companies: 0,
        drives: 0,
        applications: 0,
        pending: 0,
        selected: 0,
        rejected: 0,
        withdrawn: 0
    });


    useEffect(() => {

        async function fetchStatistics() {

            try {

                const { count: studentsCount, error: studentsError } =
                    await supabase
                        .from("students")
                        .select("*", { count: "exact", head: true });


                if (studentsError)
                    throw studentsError;



                const { count: companiesCount, error: companiesError } =
                    await supabase
                        .from("companies")
                        .select("*", { count: "exact", head: true });


                if (companiesError)
                    throw companiesError;



                const { count: drivesCount, error: drivesError } =
                    await supabase
                        .from("placement_drives")
                        .select("*", { count: "exact", head: true });


                if (drivesError)
                    throw drivesError;



                const [
                    applicationsResult,
                    appliedApplicationsResult,
                    selectedApplicationsResult,
                    rejectedApplicationsResult,
                    withdrawnApplicationsResult
                ] = await Promise.all([
                    supabase
                        .from("applications")
                        .select("*", { count: "exact", head: true }),
                    supabase
                        .from("applications")
                        .select("*", { count: "exact", head: true })
                        .eq("status", APPLICATION_STATUS.APPLIED),
                    supabase
                        .from("applications")
                        .select("*", { count: "exact", head: true })
                        .eq("status", APPLICATION_STATUS.SELECTED),
                    supabase
                        .from("applications")
                        .select("*", { count: "exact", head: true })
                        .eq("status", APPLICATION_STATUS.REJECTED),
                    supabase
                        .from("applications")
                        .select("*", { count: "exact", head: true })
                        .eq("status", APPLICATION_STATUS.WITHDRAWN)
                ]);


                if (applicationsResult.error)
                    throw applicationsResult.error;


                if (selectedApplicationsResult.error)
                    throw selectedApplicationsResult.error;


                if (rejectedApplicationsResult.error)
                    throw rejectedApplicationsResult.error;


                if (appliedApplicationsResult.error)
                    throw appliedApplicationsResult.error;


                if (withdrawnApplicationsResult.error)
                    throw withdrawnApplicationsResult.error;


                const applicationsCount = applicationsResult.count || 0;
                const appliedApplicationsCount =
                    appliedApplicationsResult.count || 0;
                const selectedApplicationsCount =
                    selectedApplicationsResult.count || 0;
                const rejectedApplicationsCount =
                    rejectedApplicationsResult.count || 0;
                const withdrawnApplicationsCount =
                    withdrawnApplicationsResult.count || 0;



                setStats({

                    students: studentsCount || 0,

                    companies: companiesCount || 0,

                    drives: drivesCount || 0,

                    applications: applicationsCount,

                    pending: appliedApplicationsCount,

                    selected: selectedApplicationsCount,

                    rejected: rejectedApplicationsCount,

                    withdrawn: withdrawnApplicationsCount

                });


            }
            catch (error) {

                console.log(
                    "Statistics Fetch Error:",
                    error.message
                );

            }

        }

        fetchStatistics();

    }, []);



    return (

        <>
            <div className="dashboard-cards">


                    <DashboardCard
                        title="Total Students"
                        value={stats.students}
                    />


                    <DashboardCard
                        title="Total Companies"
                        value={stats.companies}
                    />


                    <DashboardCard
                        title="Placement Drives"
                        value={stats.drives}
                    />


                    <DashboardCard
                        title="Applications"
                        value={stats.applications}
                    />


            </div>


            <Statistics stats={stats} />
        </>

    )

}


export default AdminDashboard;
