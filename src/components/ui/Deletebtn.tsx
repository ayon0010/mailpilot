"use client";

import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { Button } from "./button";
import { RiDeleteBinFill } from "@remixicon/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type DeleteBtnProps = {
  id: string;
};

export default function Deletebtn({ id }: DeleteBtnProps) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: "Delete Campaign?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    const res = await fetch(`/api/campaigns/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      await Swal.fire({
        title: "Error",
        text: "Failed to delete campaign.",
        icon: "error",
      });
      return;
    }

    await Swal.fire({
      title: "Deleted!",
      text: "Campaign has been deleted successfully.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });

    router.refresh();
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button onClick={handleDelete} variant="destructive" size="icon">
          <RiDeleteBinFill />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Delete</TooltipContent>
    </Tooltip>
  );
}
